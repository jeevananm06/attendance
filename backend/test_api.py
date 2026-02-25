"""
Comprehensive API Test Script for Labour Attendance Management System
Run with: python test_api.py
"""

import requests
import json
from datetime import date, timedelta

BASE_URL = "http://127.0.0.1:8000"

# Test results tracking
passed = 0
failed = 0
results = []

def log_result(test_name, success, details=""):
    global passed, failed
    status = "✅ PASS" if success else "❌ FAIL"
    if success:
        passed += 1
    else:
        failed += 1
    results.append(f"{status}: {test_name}")
    if details and not success:
        results.append(f"       Details: {details}")
    print(f"{status}: {test_name}")
    if details and not success:
        print(f"       Details: {details}")

def test_endpoint(method, endpoint, test_name, expected_status=200, data=None, headers=None, params=None):
    try:
        url = f"{BASE_URL}{endpoint}"
        if method == "GET":
            response = requests.get(url, headers=headers, params=params)
        elif method == "POST":
            if headers and "application/x-www-form-urlencoded" in headers.get("Content-Type", ""):
                response = requests.post(url, data=data, headers=headers)
            else:
                response = requests.post(url, json=data, headers=headers)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        
        success = response.status_code == expected_status
        details = f"Expected {expected_status}, got {response.status_code}" if not success else ""
        if not success and response.text:
            details += f" - {response.text[:200]}"
        log_result(test_name, success, details)
        return response if success else None
    except Exception as e:
        log_result(test_name, False, str(e))
        return None

def main():
    print("\n" + "="*60)
    print("Labour Attendance Management System - API Tests")
    print("="*60 + "\n")
    
    # ==================== AUTH TESTS ====================
    print("\n--- Authentication Tests ---\n")
    
    # Test 1: Login with admin
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": "admin", "password": "admin123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    admin_token = None
    if response.status_code == 200:
        admin_token = response.json().get("access_token")
        log_result("Admin Login", True)
    else:
        log_result("Admin Login", False, response.text)
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}
    
    # Test 2: Get current user info
    test_endpoint("GET", "/auth/me", "Get Current User Info", headers=admin_headers)
    
    # Test 3: Get all users (admin only)
    test_endpoint("GET", "/auth/users", "Get All Users (Admin)", headers=admin_headers)
    
    # Test 4: Login with invalid credentials
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": "invalid", "password": "invalid"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    log_result("Invalid Login Rejected", response.status_code == 401)
    
    # ==================== LABOURS TESTS ====================
    print("\n--- Labours Tests ---\n")
    
    # Test 5: Get all labours
    response = test_endpoint("GET", "/labours/", "Get All Labours", headers=admin_headers)
    labours = response.json() if response else []
    
    # Test 6: Create a new labour
    test_labour = {
        "name": "Test Worker",
        "phone": "9876543210",
        "daily_wage": 500.0,
        "joined_date": date.today().isoformat()
    }
    response = test_endpoint("POST", "/labours/", "Create Labour", headers=admin_headers, data=test_labour)
    test_labour_id = response.json().get("id") if response else None
    
    # Test 7: Get labour by ID
    if test_labour_id:
        test_endpoint("GET", f"/labours/{test_labour_id}", "Get Labour by ID", headers=admin_headers)
    
    # Test 8: Update labour
    if test_labour_id:
        update_data = {"name": "Test Worker Updated", "daily_wage": 550.0}
        test_endpoint("PUT", f"/labours/{test_labour_id}", "Update Labour", headers=admin_headers, data=update_data)
    
    # ==================== ATTENDANCE TESTS ====================
    print("\n--- Attendance Tests ---\n")
    
    today = date.today().isoformat()
    
    # Test 9: Get attendance for today
    test_endpoint("GET", f"/attendance/date/{today}", "Get Attendance by Date", headers=admin_headers)
    
    # Test 10: Mark attendance
    if test_labour_id:
        attendance_data = {
            "labour_id": test_labour_id,
            "date": today,
            "status": "present"
        }
        test_endpoint("POST", "/attendance/", "Mark Attendance", headers=admin_headers, data=attendance_data)
    
    # Test 11: Get labour attendance history
    if test_labour_id:
        test_endpoint("GET", f"/attendance/labour/{test_labour_id}", "Get Labour Attendance History", headers=admin_headers)
    
    # ==================== SALARY TESTS ====================
    print("\n--- Salary Tests ---\n")
    
    # Test 12: Get pending salaries
    test_endpoint("GET", "/salary/pending", "Get Pending Salaries", headers=admin_headers)
    
    # Test 13: Get salary summary
    test_endpoint("GET", "/salary/summary", "Get Salary Summary", headers=admin_headers)
    
    # Test 14: Calculate salary for test labour
    if test_labour_id:
        test_endpoint("POST", f"/salary/calculate/{test_labour_id}", "Calculate Salary", headers=admin_headers)
    
    # ==================== STATS TESTS ====================
    print("\n--- Statistics Tests ---\n")
    
    # Test 15: Get overview stats
    test_endpoint("GET", "/stats/overview", "Get Overview Stats", headers=admin_headers)
    
    # Test 16: Get weekly stats
    test_endpoint("GET", "/stats/weekly", "Get Weekly Stats", headers=admin_headers, params={"weeks": 4})
    
    # Test 17: Get all labours stats
    test_endpoint("GET", "/stats/all-labours", "Get All Labours Stats", headers=admin_headers)
    
    # ==================== OVERTIME TESTS ====================
    print("\n--- Overtime Tests ---\n")
    
    # Test 18: Get all overtime records
    test_endpoint("GET", "/overtime/", "Get All Overtime Records", headers=admin_headers)
    
    # Test 19: Create overtime record
    if test_labour_id:
        overtime_data = {
            "labour_id": test_labour_id,
            "date": today,
            "hours": 2.0,
            "rate_multiplier": 1.5
        }
        test_endpoint("POST", "/overtime/", "Create Overtime Record", headers=admin_headers, data=overtime_data)
    
    # ==================== ADVANCES TESTS ====================
    print("\n--- Advances Tests ---\n")
    
    # Test 20: Get all advances
    test_endpoint("GET", "/advances/", "Get All Advances", headers=admin_headers)
    
    # Test 21: Create advance
    if test_labour_id:
        advance_data = {
            "labour_id": test_labour_id,
            "amount": 1000.0,
            "date": today,
            "reason": "Test advance"
        }
        test_endpoint("POST", "/advances/", "Create Advance", headers=admin_headers, data=advance_data)
    
    # ==================== LEAVES TESTS ====================
    print("\n--- Leaves Tests ---\n")
    
    # Test 22: Get all leaves
    test_endpoint("GET", "/leaves/", "Get All Leaves", headers=admin_headers)
    
    # Test 23: Create leave request
    if test_labour_id:
        leave_data = {
            "labour_id": test_labour_id,
            "start_date": (date.today() + timedelta(days=1)).isoformat(),
            "end_date": (date.today() + timedelta(days=2)).isoformat(),
            "leave_type": "casual",
            "reason": "Test leave"
        }
        test_endpoint("POST", "/leaves/", "Create Leave Request", headers=admin_headers, data=leave_data)
    
    # ==================== SITES TESTS ====================
    print("\n--- Sites Tests ---\n")
    
    # Test 24: Get all sites
    test_endpoint("GET", "/sites/", "Get All Sites", headers=admin_headers)
    
    # Test 25: Create site
    site_data = {"name": "Test Site", "address": "123 Test Street"}
    response = test_endpoint("POST", "/sites/", "Create Site", headers=admin_headers, data=site_data)
    test_site_id = response.json().get("id") if response else None
    
    # Test 26: Get sites summary
    test_endpoint("GET", "/sites/summary", "Get Sites Summary", headers=admin_headers)
    
    # Test 27: Assign labour to site
    if test_labour_id and test_site_id:
        response = requests.post(
            f"{BASE_URL}/sites/assign?labour_id={test_labour_id}&site_id={test_site_id}",
            headers=admin_headers
        )
        log_result("Assign Labour to Site", response.status_code == 200, 
                   f"Status: {response.status_code}" if response.status_code != 200 else "")
    
    # ==================== AUDIT TESTS ====================
    print("\n--- Audit Tests ---\n")
    
    # Test 28: Get recent audit logs
    test_endpoint("GET", "/audit/recent", "Get Recent Audit Logs", headers=admin_headers, params={"limit": 10})
    
    # ==================== BACKUP TESTS ====================
    print("\n--- Backup Tests ---\n")
    
    # Test 29: Get backup list
    test_endpoint("GET", "/backup/", "Get Backup List", headers=admin_headers)
    
    # Test 30: Create backup
    test_endpoint("POST", "/backup/create", "Create Backup", headers=admin_headers)
    
    # ==================== EXPORT TESTS ====================
    print("\n--- Export Tests ---\n")
    
    # Test 31: Export labours
    test_endpoint("GET", "/export/labours", "Export Labours CSV", headers=admin_headers)
    
    # Test 32: Export attendance
    test_endpoint("GET", "/export/attendance", "Export Attendance CSV", headers=admin_headers)
    
    # ==================== USER MANAGEMENT TESTS ====================
    print("\n--- User Management Tests ---\n")
    
    # Test 33: Register new user
    new_user = {"username": "testuser", "password": "test123456", "role": "manager"}
    response = test_endpoint("POST", "/auth/register", "Register New User", headers=admin_headers, data=new_user)
    
    # Test 34: Update user
    update_user_data = {"role": "labour", "is_active": True}
    test_endpoint("PUT", "/auth/users/testuser", "Update User Role", headers=admin_headers, data=update_user_data)
    
    # Test 35: Login as new user
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": "testuser", "password": "test123456"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    log_result("Login as New User", response.status_code == 200)
    
    # ==================== CLEANUP ====================
    print("\n--- Cleanup ---\n")
    
    # Test 36: Delete test labour (soft delete)
    if test_labour_id:
        test_endpoint("DELETE", f"/labours/{test_labour_id}", "Delete Test Labour", headers=admin_headers)
    
    # ==================== SUMMARY ====================
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"\n✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Total:  {passed + failed}")
    print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%\n")
    
    if failed > 0:
        print("\nFailed Tests:")
        for r in results:
            if "FAIL" in r:
                print(f"  {r}")
    
    print("\n" + "="*60)

if __name__ == "__main__":
    main()
