from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from datetime import date, datetime, timedelta
from typing import Optional
import io

import calendar as cal_module
from ..models import User
from ..auth import get_current_manager_or_admin, get_current_admin
from ..db_wrapper import (
    get_all_labours, get_attendance_by_labour, get_salary_records,
    get_overtime_records, get_advances, get_leaves
)
from ..salary_calculator import get_week_boundaries

router = APIRouter(prefix="/reports", tags=["Reports"])


def generate_html_report(title: str, content: str) -> str:
    """Generate HTML report with styling"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>{title}</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            h1 {{ color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }}
            h2 {{ color: #374151; margin-top: 30px; }}
            table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
            th, td {{ border: 1px solid #d1d5db; padding: 12px; text-align: left; }}
            th {{ background-color: #f3f4f6; font-weight: bold; }}
            tr:nth-child(even) {{ background-color: #f9fafb; }}
            .summary {{ background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; }}
            .summary-item {{ display: inline-block; margin-right: 40px; }}
            .summary-value {{ font-size: 24px; font-weight: bold; color: #1e40af; }}
            .summary-label {{ color: #6b7280; }}
            .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #d1d5db; color: #6b7280; font-size: 12px; }}
            .positive {{ color: #059669; }}
            .negative {{ color: #dc2626; }}
            @media print {{
                body {{ margin: 20px; }}
                .no-print {{ display: none; }}
            }}
        </style>
    </head>
    <body>
        <h1>{title}</h1>
        <p>Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        {content}
        <div class="footer">
            <p>Labour Attendance Management System - Confidential Report</p>
        </div>
    </body>
    </html>
    """


@router.get("/monthly")
async def get_monthly_report(
    year: int,
    month: int,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Generate monthly report"""
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)
    
    labours = get_all_labours(include_inactive=True)
    
    report_data = []
    total_wages = 0
    total_paid = 0
    total_overtime = 0
    total_advances = 0
    
    for labour in labours:
        attendance = get_attendance_by_labour(labour.id, start_date, end_date)
        salary_records = get_salary_records(labour_id=labour.id)
        overtime = get_overtime_records(labour_id=labour.id, start_date=start_date, end_date=end_date)
        advances = get_advances(labour_id=labour.id)
        
        # Filter salary records for this month
        month_salary = [s for s in salary_records if start_date <= s.week_end <= end_date]
        
        present = sum(1 for a in attendance if a.status.value == 'present')
        half_days = sum(1 for a in attendance if a.status.value == 'half_day')
        absent = sum(1 for a in attendance if a.status.value == 'absent')
        
        wages = sum(s.total_amount for s in month_salary)
        paid = sum(s.total_amount for s in month_salary if s.is_paid)
        ot_amount = sum(o.amount for o in overtime)
        adv_amount = sum(a.amount for a in advances if start_date <= a.date <= end_date)
        
        total_wages += wages
        total_paid += paid
        total_overtime += ot_amount
        total_advances += adv_amount
        
        report_data.append({
            "name": labour.name,
            "present": present,
            "half_days": half_days,
            "absent": absent,
            "wages": wages,
            "overtime": ot_amount,
            "advances": adv_amount,
            "paid": paid,
            "pending": wages + ot_amount - paid - adv_amount
        })
    
    # Generate HTML
    rows = ""
    for r in report_data:
        rows += f"""
        <tr>
            <td>{r['name']}</td>
            <td>{r['present']}</td>
            <td>{r['half_days']}</td>
            <td>{r['absent']}</td>
            <td>₹{r['wages']:,.2f}</td>
            <td>₹{r['overtime']:,.2f}</td>
            <td>₹{r['advances']:,.2f}</td>
            <td>₹{r['paid']:,.2f}</td>
            <td class="{'positive' if r['pending'] <= 0 else 'negative'}">₹{r['pending']:,.2f}</td>
        </tr>
        """
    
    content = f"""
    <div class="summary">
        <div class="summary-item">
            <div class="summary-value">{len(labours)}</div>
            <div class="summary-label">Total Labours</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{total_wages:,.2f}</div>
            <div class="summary-label">Total Wages</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{total_overtime:,.2f}</div>
            <div class="summary-label">Total Overtime</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{total_paid:,.2f}</div>
            <div class="summary-label">Total Paid</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{total_advances:,.2f}</div>
            <div class="summary-label">Total Advances</div>
        </div>
    </div>
    
    <h2>Labour Details</h2>
    <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>Present</th>
                <th>Half Days</th>
                <th>Absent</th>
                <th>Wages</th>
                <th>Overtime</th>
                <th>Advances</th>
                <th>Paid</th>
                <th>Pending</th>
            </tr>
        </thead>
        <tbody>
            {rows}
        </tbody>
    </table>
    """
    
    month_name = date(year, month, 1).strftime('%B %Y')
    html = generate_html_report(f"Monthly Report - {month_name}", content)
    
    return Response(
        content=html,
        media_type="text/html",
        headers={
            "Content-Disposition": f"inline; filename=monthly_report_{year}_{month:02d}.html"
        }
    )


@router.get("/labour/{labour_id}")
async def get_labour_report(
    labour_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Generate detailed report for a specific labour"""
    from ..db_wrapper import get_labour
    
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(status_code=404, detail="Labour not found")
    
    if not start_date:
        start_date = labour.joined_date
    if not end_date:
        end_date = date.today()
    
    attendance = get_attendance_by_labour(labour_id, start_date, end_date)
    salary_records = get_salary_records(labour_id=labour_id)
    overtime = get_overtime_records(labour_id=labour_id, start_date=start_date, end_date=end_date)
    advances = get_advances(labour_id=labour_id)
    leaves = get_leaves(labour_id=labour_id)
    
    present = sum(1 for a in attendance if a.status.value == 'present')
    half_days = sum(1 for a in attendance if a.status.value == 'half_day')
    absent = sum(1 for a in attendance if a.status.value == 'absent')
    
    total_wages = sum(s.total_amount for s in salary_records)
    total_paid = sum(s.total_amount for s in salary_records if s.is_paid)
    total_overtime = sum(o.amount for o in overtime)
    total_advances = sum(a.amount for a in advances)
    pending_advances = sum(a.amount for a in advances if not a.is_deducted)
    
    # Salary records table
    salary_rows = ""
    for s in sorted(salary_records, key=lambda x: x.week_end, reverse=True)[:20]:
        salary_rows += f"""
        <tr>
            <td>{s.week_start} - {s.week_end}</td>
            <td>{s.days_present}</td>
            <td>₹{s.total_amount:,.2f}</td>
            <td>{'✓ Paid' if s.is_paid else 'Pending'}</td>
            <td>{s.paid_date if s.paid_date else '-'}</td>
        </tr>
        """
    
    # Overtime records table
    overtime_rows = ""
    for o in sorted(overtime, key=lambda x: x.date, reverse=True)[:10]:
        overtime_rows += f"""
        <tr>
            <td>{o.date}</td>
            <td>{o.hours}</td>
            <td>{o.rate_multiplier}x</td>
            <td>₹{o.amount:,.2f}</td>
        </tr>
        """
    
    content = f"""
    <div class="summary">
        <div class="summary-item">
            <div class="summary-value">{labour.name}</div>
            <div class="summary-label">Labour Name</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{labour.daily_wage}</div>
            <div class="summary-label">Daily Wage</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">{labour.joined_date}</div>
            <div class="summary-label">Joined Date</div>
        </div>
    </div>
    
    <h2>Attendance Summary ({start_date} to {end_date})</h2>
    <div class="summary">
        <div class="summary-item">
            <div class="summary-value">{present}</div>
            <div class="summary-label">Present Days</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">{half_days}</div>
            <div class="summary-label">Half Days</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">{absent}</div>
            <div class="summary-label">Absent Days</div>
        </div>
    </div>
    
    <h2>Financial Summary</h2>
    <div class="summary">
        <div class="summary-item">
            <div class="summary-value">₹{total_wages:,.2f}</div>
            <div class="summary-label">Total Wages</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{total_overtime:,.2f}</div>
            <div class="summary-label">Overtime Earned</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{total_paid:,.2f}</div>
            <div class="summary-label">Total Paid</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{total_advances:,.2f}</div>
            <div class="summary-label">Total Advances</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{pending_advances:,.2f}</div>
            <div class="summary-label">Pending Advances</div>
        </div>
    </div>
    
    <h2>Recent Salary Records</h2>
    <table>
        <thead>
            <tr>
                <th>Week</th>
                <th>Days Present</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Paid Date</th>
            </tr>
        </thead>
        <tbody>
            {salary_rows if salary_rows else '<tr><td colspan="5">No salary records</td></tr>'}
        </tbody>
    </table>
    
    <h2>Overtime Records</h2>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            {overtime_rows if overtime_rows else '<tr><td colspan="4">No overtime records</td></tr>'}
        </tbody>
    </table>
    """
    
    html = generate_html_report(f"Labour Report - {labour.name}", content)
    
    return Response(
        content=html,
        media_type="text/html",
        headers={
            "Content-Disposition": f"inline; filename=labour_report_{labour_id}.html"
        }
    )


@router.get("/summary")
async def get_summary_report(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Generate overall summary report"""
    labours = get_all_labours(include_inactive=True)
    all_salary = get_salary_records()
    all_overtime = get_overtime_records()
    all_advances = get_advances()
    
    active_labours = sum(1 for l in labours if l.is_active)
    total_wages = sum(s.total_amount for s in all_salary)
    total_paid = sum(s.total_amount for s in all_salary if s.is_paid)
    total_overtime = sum(o.amount for o in all_overtime)
    total_advances = sum(a.amount for a in all_advances)
    pending_advances = sum(a.amount for a in all_advances if not a.is_deducted)
    
    # Top earners
    labour_earnings = {}
    for s in all_salary:
        labour_earnings[s.labour_id] = labour_earnings.get(s.labour_id, 0) + s.total_amount
    
    top_earners = sorted(labour_earnings.items(), key=lambda x: x[1], reverse=True)[:5]
    top_earners_rows = ""
    for lid, amount in top_earners:
        labour = next((l for l in labours if l.id == lid), None)
        if labour:
            top_earners_rows += f"<tr><td>{labour.name}</td><td>₹{amount:,.2f}</td></tr>"
    
    content = f"""
    <div class="summary">
        <div class="summary-item">
            <div class="summary-value">{len(labours)}</div>
            <div class="summary-label">Total Labours</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">{active_labours}</div>
            <div class="summary-label">Active Labours</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{total_wages:,.2f}</div>
            <div class="summary-label">Total Wages</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{total_paid:,.2f}</div>
            <div class="summary-label">Total Paid</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{total_wages - total_paid:,.2f}</div>
            <div class="summary-label">Pending Wages</div>
        </div>
    </div>
    
    <h2>Additional Earnings & Deductions</h2>
    <div class="summary">
        <div class="summary-item">
            <div class="summary-value">₹{total_overtime:,.2f}</div>
            <div class="summary-label">Total Overtime</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{total_advances:,.2f}</div>
            <div class="summary-label">Total Advances Given</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">₹{pending_advances:,.2f}</div>
            <div class="summary-label">Pending Advances</div>
        </div>
    </div>
    
    <h2>Top Earners</h2>
    <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>Total Earned</th>
            </tr>
        </thead>
        <tbody>
            {top_earners_rows if top_earners_rows else '<tr><td colspan="2">No data</td></tr>'}
        </tbody>
    </table>
    """
    
    html = generate_html_report("Organization Summary Report", content)
    
    return Response(
        content=html,
        media_type="text/html",
        headers={
            "Content-Disposition": "inline; filename=summary_report.html"
        }
    )


@router.get("/payroll")
async def get_payroll_register(
    year: int,
    month: int,
    current_user: User = Depends(get_current_admin)
):
    """Generate printable payroll register for a given month (Admin only)"""
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="month must be 1–12")

    start_date = date(year, month, 1)
    end_date = date(year, month, cal_module.monthrange(year, month)[1])
    month_name = start_date.strftime('%B %Y')

    labours = get_all_labours(include_inactive=True)
    all_advances = get_advances()

    rows = ""
    grand_gross = grand_advance = grand_net = grand_paid = 0

    for labour in sorted(labours, key=lambda x: x.name):
        records = get_salary_records(labour_id=labour.id)
        month_records = [r for r in records if start_date <= r.week_end <= end_date]
        if not month_records:
            continue

        gross = sum(r.total_amount for r in month_records)
        paid = sum(r.paid_amount for r in month_records)
        days = sum(r.days_present for r in month_records)

        adv_given = sum(
            a.amount for a in all_advances
            if a.labour_id == labour.id and start_date <= a.date <= end_date
        )
        net = max(0.0, gross - adv_given)
        balance = gross - paid

        grand_gross += gross
        grand_advance += adv_given
        grand_net += net
        grand_paid += paid

        status_color = "#059669" if balance <= 0 else "#dc2626"
        rows += f"""
        <tr>
            <td>{labour.name}</td>
            <td style="text-align:right">&#8377;{labour.daily_wage:,.0f}</td>
            <td style="text-align:center">{days:.1f}</td>
            <td style="text-align:right">&#8377;{gross:,.2f}</td>
            <td style="text-align:right">&#8377;{adv_given:,.2f}</td>
            <td style="text-align:right">&#8377;{net:,.2f}</td>
            <td style="text-align:right">&#8377;{paid:,.2f}</td>
            <td style="text-align:right;color:{status_color}">&#8377;{balance:,.2f}</td>
        </tr>"""

    content = f"""
    <div class="summary">
        <div class="summary-item">
            <div class="summary-value">&#8377;{grand_gross:,.2f}</div>
            <div class="summary-label">Total Gross</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">&#8377;{grand_paid:,.2f}</div>
            <div class="summary-label">Total Paid</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">&#8377;{grand_gross - grand_paid:,.2f}</div>
            <div class="summary-label">Total Balance</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">&#8377;{grand_advance:,.2f}</div>
            <div class="summary-label">Total Advances</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Name</th><th>Daily Rate</th><th>Days</th>
                <th>Gross</th><th>Advance</th><th>Net</th>
                <th>Paid</th><th>Balance</th>
            </tr>
        </thead>
        <tbody>
            {rows if rows else '<tr><td colspan="8" style="text-align:center">No records for this period</td></tr>'}
        </tbody>
        <tfoot>
            <tr style="font-weight:bold;background:#f3f4f6">
                <td>Total</td><td></td><td></td>
                <td style="text-align:right">&#8377;{grand_gross:,.2f}</td>
                <td style="text-align:right">&#8377;{grand_advance:,.2f}</td>
                <td style="text-align:right">&#8377;{grand_net:,.2f}</td>
                <td style="text-align:right">&#8377;{grand_paid:,.2f}</td>
                <td style="text-align:right">&#8377;{grand_gross - grand_paid:,.2f}</td>
            </tr>
        </tfoot>
    </table>"""

    html = generate_html_report(f"Payroll Register — {month_name}", content)
    return Response(
        content=html,
        media_type="text/html",
        headers={
            "Content-Disposition": f"inline; filename=payroll_register_{year}_{month:02d}.html"
        }
    )
