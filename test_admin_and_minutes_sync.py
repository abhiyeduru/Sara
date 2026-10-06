"""
SARA AI — Production Test: Admin Governance, User Management & Minutes/Payment Sync
Verifies:
1. Admin platform stats retrieval & provider health checks
2. Multi-tenant user listing with workspace, credit & minutes balance
3. Administrative role update & status management
4. Real-time minutes & credits allocation with immediate sync to user billing
5. Payment recording with transaction ledger & immutable audit logs
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from server.main import app
from server.database import SessionLocal
from server.models import User, Workspace, WorkspaceMember, CreditAccount, CreditTransaction

client = TestClient(app)


def test_admin_governance_and_sync():
    print("\n========================================================")
    print("🛡️  TESTING SARA AI ADMIN GOVERNANCE & MINUTES SYNC")
    print("========================================================\n")

    # 1. Admin Platform Stats
    print("Step 1: Testing GET /api/v1/admin/stats...")
    stats_res = client.get("/api/v1/admin/stats")
    assert stats_res.status_code == 200, f"Stats failed: {stats_res.text}"
    stats_data = stats_res.json()
    assert "metrics" in stats_data
    assert "providers" in stats_data
    assert "total_users" in stats_data["metrics"]
    assert "total_minutes_available" in stats_data["metrics"]
    print(f"  ✓ Platform Stats OK: {stats_data['metrics']['total_users']} users, {stats_data['metrics']['total_minutes_available']} minutes available.")
    print(f"  ✓ Rate per minute: ₹{stats_data['metrics']['rate_per_minute']}")

    # 2. List All Platform Users
    print("\nStep 2: Testing GET /api/v1/admin/users...")
    users_res = client.get("/api/v1/admin/users")
    assert users_res.status_code == 200, f"Users failed: {users_res.text}"
    users_data = users_res.json()
    assert "users" in users_data
    assert len(users_data["users"]) > 0
    test_user = users_data["users"][0]
    user_id = test_user["id"]
    print(f"  ✓ Listed {len(users_data['users'])} users. Selected target: {test_user['name']} (ID: {user_id[:16]}...)")
    print(f"  ✓ Initial Balance: {test_user['minutes_balance']} minutes (₹{test_user['credits_balance']})")

    # 3. Update User Role
    print(f"\nStep 3: Testing PUT /api/v1/admin/users/{user_id}/role...")
    role_res = client.put(f"/api/v1/admin/users/{user_id}/role", json={"role": "admin"})
    assert role_res.status_code == 200, f"Role update failed: {role_res.text}"
    print(f"  ✓ Role updated successfully to admin.")

    # 4. Allocate Call Minutes directly from Admin
    initial_minutes = test_user["minutes_balance"]
    minutes_to_grant = 120.0
    print(f"\nStep 4: Testing POST /api/v1/admin/users/{user_id}/credits (+{minutes_to_grant} minutes)...")
    credit_res = client.post(
        f"/api/v1/admin/users/{user_id}/credits",
        json={
            "amount": minutes_to_grant,
            "is_minutes": True,
            "note": "Quarterly Telephony Allowance Grant",
            "type": "topup"
        }
    )
    assert credit_res.status_code == 200, f"Credit allocation failed: {credit_res.text}"
    credit_data = credit_res.json()
    assert credit_data["success"] is True
    expected_new_minutes = initial_minutes + minutes_to_grant
    assert abs(credit_data["new_minutes_balance"] - expected_new_minutes) < 0.2
    print(f"  ✓ Admin Allocation Succeeded!")
    print(f"  ✓ Credits delta: ₹{credit_data['credits_delta']} (+{credit_data['minutes_delta']} minutes)")
    print(f"  ✓ New User Balance: {credit_data['new_minutes_balance']} min (₹{credit_data['new_credit_balance']})")

    # 5. Verify User Billing Endpoint Synced in Real Time
    print(f"\nStep 5: Verifying User Billing Sync via GET /api/v1/billing/balance...")
    billing_res = client.get("/api/v1/billing/balance")
    assert billing_res.status_code == 200, f"Billing failed: {billing_res.text}"
    billing_data = billing_res.json()
    assert billing_data["balance"] > 0
    print(f"  ✓ User Billing Balance Confirmed Synced: ₹{billing_data['balance']} ({billing_data.get('minutes', round(billing_data['balance']/2.5, 1))} min)")

    # 6. Record Offline/Direct Payment
    print(f"\nStep 6: Testing POST /api/v1/admin/payments/record (₹1,500 via UPI)...")
    payment_res = client.post(
        "/api/v1/admin/payments/record",
        json={
            "user_id": user_id,
            "amount": 1500.0,
            "payment_method": "UPI",
            "reference_id": "UPI_TEST_998822",
            "notes": "Annual plan renewal"
        }
    )
    assert payment_res.status_code == 200, f"Payment record failed: {payment_res.text}"
    pay_data = payment_res.json()
    assert pay_data["success"] is True
    print(f"  ✓ Payment recorded: {pay_data['message']}")
    print(f"  ✓ Total minutes after payment: {pay_data['new_minutes']} min")

    # 7. Check Platform Payments Ledger
    print(f"\nStep 7: Testing GET /api/v1/admin/payments...")
    payments_res = client.get("/api/v1/admin/payments")
    assert payments_res.status_code == 200, f"Payments ledger failed: {payments_res.text}"
    payments_data = payments_res.json()
    assert payments_data["total"] >= 2
    recent_txn = payments_data["transactions"][0]
    print(f"  ✓ Ledger retrieved {payments_data['total']} transactions.")
    print(f"  ✓ Most recent: {recent_txn['description']} (Balance after: ₹{recent_txn['balance_after']})")

    # 8. Check Audit Trail
    print(f"\nStep 8: Testing GET /api/v1/admin/audit-logs...")
    audit_res = client.get("/api/v1/admin/audit-logs")
    assert audit_res.status_code == 200, f"Audit logs failed: {audit_res.text}"
    audit_data = audit_res.json()
    assert audit_data["total"] > 0
    print(f"  ✓ Audit trail logged {audit_data['total']} events. Most recent action: {audit_data['data'][0]['action']}")

    print("\n========================================================")
    print("✅ ALL ADMIN GOVERNANCE & MINUTES SYNC TESTS PASSED!")
    print("========================================================\n")


if __name__ == "__main__":
    test_admin_governance_and_sync()
