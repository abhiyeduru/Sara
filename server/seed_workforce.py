"""
SARA AI — AI Workforce Data Seeder
Populates initial employees, teams, workflows, tasks, leads, knowledge sources, and audit logs.
"""
import uuid
from datetime import datetime, timezone
from server.database import SessionLocal
from server.models import (
    User, Organization, Workspace, WorkspaceMember, AIEmployee, AIEmployeeSkill,
    AIEmployeePermission, AITeam, AITeamMember, Task, Workflow, Lead,
    KnowledgeSource, KnowledgeDocument, CreditAccount, CreditTransaction,
    ActivityLog, AuditLog
)

def _uuid():
    return str(uuid.uuid4())

def _now():
    return datetime.now(timezone.utc)

def seed_workforce():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == "user_business_owner_1").first()
        if not user:
            user = User(
                id="user_business_owner_1",
                name="Abhiram Yeduru",
                email="owner@sara.ai",
                display_name="Abhiram (Owner)",
                status="active"
            )
            db.add(user)
            db.commit()

        # Organization & Workspace
        org = db.query(Organization).first()
        if not org:
            org = Organization(
                id="org_default_1",
                name="SARA AI Global Corp",
                industry="Real Estate & AI Automation",
                company_size="11-50",
            )
            db.add(org)
            db.flush()

        ws = db.query(Workspace).filter(Workspace.id == "ws_default_1").first()
        if not ws:
            ws = Workspace(
                id="ws_default_1",
                organization_id=org.id,
                name="SARA Headquarters",
                slug="sara-hq",
                plan="enterprise"
            )
            db.add(ws)
            db.flush()

            member = WorkspaceMember(
                workspace_id=ws.id,
                user_id=user.id,
                role="owner"
            )
            db.add(member)
            db.commit()

        # Check if already seeded
        if db.query(AIEmployee).filter(AIEmployee.workspace_id == ws.id).count() > 0:
            print("AI Employees already seeded.")
            return

        print("Seeding AI Employees...")
        emp1 = AIEmployee(
            id=_uuid(),
            workspace_id=user.id,
            name="Lakshmi",
            role="Senior Real Estate Sales Executive",
            avatar_url="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
            voice_id="3a8e6fea-81e5-4d4d-8755-86093146cdb8",
            voice_name="Skylar",
            compiled_prompt="You are Lakshmi, a charismatic, professional real estate sales consultant for ABC Properties in Hyderabad. You qualify buyer intent, answer property specifications accurately, and schedule site tours.",
            status="active",
            total_calls=142,
            total_tasks=89,
            total_leads=48,
            performance_score=4.9,
            created_by=user.id,
        )
        emp2 = AIEmployee(
            id=_uuid(),
            workspace_id=user.id,
            name="Arjun",
            role="Inbound Customer Support Specialist",
            avatar_url="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150",
            voice_id="563605b0-aa1e-4509-a78c-02cf584742a7",
            voice_name="Archie",
            compiled_prompt="You are Arjun, empathetic customer care specialist. You answer technical questions, explain warranty terms, resolve billing grievances, and escalate complaints with complete context.",
            status="active",
            total_calls=238,
            total_tasks=176,
            total_leads=12,
            performance_score=4.8,
            created_by=user.id,
        )
        emp3 = AIEmployee(
            id=_uuid(),
            workspace_id=user.id,
            name="Priya",
            role="Operations & Document Verification AI",
            avatar_url="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
            voice_id="e23be800-47b7-4a67-9c98-dfd0bfb68c92",
            voice_name="Gemma",
            compiled_prompt="You are Priya, rigorous operations manager. You verify Aadhaar and PAN documents, cross-check sales agreements against bank receipts, and trigger CRM updates.",
            status="active",
            total_calls=34,
            total_tasks=312,
            total_leads=0,
            performance_score=4.95,
            created_by=user.id,
        )
        emp4 = AIEmployee(
            id=_uuid(),
            workspace_id=user.id,
            name="Vikram",
            role="Outbound Lead Researcher",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
            voice_id="3a8e6fea-81e5-4d4d-8755-86093146cdb8",
            voice_name="Skylar",
            compiled_prompt="You are Vikram, research AI that analyzes social ads, extracts high-intent prospects, and drafts hyper-personalized follow-up emails.",
            status="active",
            total_calls=18,
            total_tasks=220,
            total_leads=95,
            performance_score=4.75,
            created_by=user.id,
        )

        db.add_all([emp1, emp2, emp3, emp4])
        db.flush()

        # Add permissions
        for emp in [emp1, emp2, emp3, emp4]:
            p1 = AIEmployeePermission(employee_id=emp.id, capability="calls:make", access="allowed")
            p2 = AIEmployeePermission(employee_id=emp.id, capability="crm:read", access="allowed")
            p3 = AIEmployeePermission(employee_id=emp.id, capability="knowledge:read", access="allowed")
            db.add_all([p1, p2, p3])

        # Team
        print("Seeding AI Team...")
        team = AITeam(
            id=_uuid(),
            workspace_id=user.id,
            name="Autonomous Sales & Outreach Team",
            mission="Coordinates outbound voice qualification, WhatsApp messaging, and calendar scheduling.",
            department="Sales",
            status="active"
        )
        db.add(team)
        db.flush()

        tm1 = AITeamMember(team_id=team.id, employee_id=emp1.id, role="lead")
        tm2 = AITeamMember(team_id=team.id, employee_id=emp4.id, role="member")
        db.add_all([tm1, tm2])

        # Workflows
        print("Seeding Workflows...")
        wf1 = Workflow(
            id=_uuid(),
            workspace_id=user.id,
            name="Inbound Web Lead Fast-Response (30s SLA)",
            description="Trigger voice qualification call within 30 seconds of lead form submission.",
            trigger="lead_created",
            status="active",
            total_runs=182,
            success_runs=178,
            created_by=user.id,
        )
        wf2 = Workflow(
            id=_uuid(),
            workspace_id=user.id,
            name="Post-Call WhatsApp Brochure & Calendar Link",
            description="When call sentiment is positive, send verified PDF brochure and site tour booking calendar.",
            trigger="call_ended",
            status="active",
            total_runs=94,
            success_runs=94,
            created_by=user.id,
        )
        db.add_all([wf1, wf2])

        # Tasks
        print("Seeding Tasks...")
        t1 = Task(
            id=_uuid(),
            workspace_id=user.id,
            title="Follow-up Call: Rajesh Varma (Gachibowli 3 BHK)",
            description="Customer requested financing info and floor plans for Tower B, unit 1402.",
            ai_employee_id=emp1.id,
            status="running",
            priority="high",
            created_by=user.id,
        )
        t2 = Task(
            id=_uuid(),
            workspace_id=user.id,
            title="Verify Booking Agreement #ABC-8842",
            description="Verify PAN number, down payment slip, and e-signature match.",
            ai_employee_id=emp3.id,
            status="pending",
            priority="urgent",
            created_by=user.id,
        )
        t3 = Task(
            id=_uuid(),
            workspace_id=ws.id,
            title="Inbound Query Resolution: Sravani K.",
            description="Customer had query regarding possession date for Jubilee Hills Phase 2.",
            ai_employee_id=emp2.id,
            status="completed",
            priority="medium",
            created_by=user.id,
        )
        db.add_all([t1, t2, t3])

        # Leads
        print("Seeding Leads...")
        l1 = Lead(
            id=_uuid(),
            workspace_id=user.id,
            ai_employee_id=emp1.id,
            name="Rajesh Varma",
            phone="+91 98490 12345",
            email="rajesh.varma@example.com",
            status="qualified",
            pipeline_stage="Negotiation",
            lead_score=88,
            intent="3 BHK Villa, Gachibowli",
            budget="₹2.2 Cr - ₹2.8 Cr",
            source="Website",
            requirements=["3 BHK", "Clubhouse facing", "2 Car parking"],
        )
        l2 = Lead(
            id=_uuid(),
            workspace_id=user.id,
            ai_employee_id=emp1.id,
            name="Ananya Rao",
            phone="+91 99887 65432",
            email="ananya.rao@example.com",
            status="contacted",
            pipeline_stage="Site Visit Scheduled",
            lead_score=94,
            intent="4 BHK Sky Villa, Madhapur",
            budget="₹3.5 Cr+",
            source="Campaign",
            requirements=["4 BHK", "Private terrace pool"],
        )
        l3 = Lead(
            id=_uuid(),
            workspace_id=user.id,
            ai_employee_id=emp4.id,
            name="Karthik Reddy",
            phone="+91 98765 43210",
            email="karthik.reddy@techcorp.in",
            status="new",
            pipeline_stage="Lead In",
            lead_score=72,
            intent="Commercial Office Space",
            budget="₹5 Cr - ₹8 Cr",
            source="Website",
            requirements=["8000 sqft floor plate"],
        )
        db.add_all([l1, l2, l3])

        # Knowledge Sources
        print("Seeding Knowledge Sources...")
        ks1 = KnowledgeSource(
            id=_uuid(),
            workspace_id=user.id,
            employee_id=emp1.id,
            name="ABC Heights Specifications & Pricing Master Q3 2026",
            source_type="document",
            category="Products",
            file_type="pdf",
            file_size=204850,
            status="indexed",
            chunk_count=8,
            extracted_text="ABC Heights features 3 and 4 BHK luxury residences in Gachibowli with clubhouse, swimming pool, squash courts, and 100% DG backup. Pricing starts at ₹1.85 Cr for 3 BHK (1,850 sq ft) and ₹2.75 Cr for 4 BHK (2,600 sq ft). Possession date is December 2027.",
            created_by=user.id,
        )
        db.add(ks1)
        db.flush()

        kd1 = KnowledgeDocument(
            source_id=ks1.id,
            chunk_index=0,
            content="ABC Heights features 3 and 4 BHK luxury residences in Gachibowli with clubhouse, swimming pool, squash courts, and 100% DG backup. Pricing starts at ₹1.85 Cr for 3 BHK (1,850 sq ft) and ₹2.75 Cr for 4 BHK (2,600 sq ft). Possession date is December 2027.",
        )
        db.add(kd1)

        # Credit Account
        acc = db.query(CreditAccount).filter(CreditAccount.workspace_id == user.id).first()
        if not acc:
            acc = CreditAccount(
                workspace_id=user.id,
                balance=2450.0,
                total_purchased=3000.0,
                total_consumed=550.0,
                plan="enterprise"
            )
            db.add(acc)
            db.flush()

            txn1 = CreditTransaction(
                account_id=acc.id,
                amount=3000.0,
                balance_after=3000.0,
                transaction_type="topup",
                description="Enterprise Welcome Credit Package",
            )
            txn2 = CreditTransaction(
                account_id=acc.id,
                amount=-550.0,
                balance_after=2450.0,
                transaction_type="usage",
                description="Voice telephony (Sarvam + Cartesia + Groq) and LLM inferencing",
            )
            db.add_all([txn1, txn2])

        # Activities & Audits
        print("Seeding Activity and Audit Logs...")
        act1 = ActivityLog(
            id=_uuid(),
            workspace_id=user.id,
            actor_type="ai_employee",
            actor_id=emp1.id,
            actor_name="Lakshmi (Sales AI)",
            action="Completed Voice Qualification Call",
            entity_type="lead",
            entity_id=l1.id,
            details={"duration_sec": 145, "sentiment": "positive", "intent": "schedule_tour"},
        )
        act2 = ActivityLog(
            id=_uuid(),
            workspace_id=user.id,
            actor_type="ai_employee",
            actor_id=emp2.id,
            actor_name="Arjun (Support AI)",
            action="Resolved WhatsApp Inquiry",
            entity_type="customer",
            entity_id=_uuid(),
            details={"topic": "Payment receipt verification", "resolution_time_sec": 42},
        )
        act3 = ActivityLog(
            id=_uuid(),
            workspace_id=user.id,
            actor_type="system",
            actor_name="Sara Workflow Engine",
            action="Executed Trigger: Inbound Fast Response",
            entity_type="workflow",
            entity_id=wf1.id,
            details={"lead_name": "Ananya Rao", "latency_ms": 320},
        )
        db.add_all([act1, act2, act3])

        aud1 = AuditLog(
            id=_uuid(),
            workspace_id=user.id,
            actor_type="user",
            actor_id=user.id,
            actor_name="Abhiram (Owner)",
            action="ai_employee.created",
            resource_type="ai_employee",
            resource_id=emp1.id,
            new_value={"name": "Lakshmi", "role": "Senior Real Estate Sales Executive"},
            ip_address="127.0.0.1",
        )
        db.add(aud1)

        db.commit()
        print("✅ SARA AI Workforce successfully seeded!")
    except Exception as e:
        print(f"Error seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_workforce()
