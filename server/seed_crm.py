import os
import sys
from datetime import datetime, timezone, timedelta

# Add workspace to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.database import SessionLocal, init_db
from server.models import (
    User, Customer, CustomerPipeline, CallRecord, CallRecording,
    CallTranscript, CallIntelligence, ActivityTimeline, CRMTask,
    Deal, CRMAutomation, CRMAuditLog, generate_uuid, get_utc_now
)

def seed():
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == "user_business_owner_1").first()
        if not user:
            user = User(
                id="user_business_owner_1",
                email="owner@sara.ai",
                display_name="Abhiram Yeduru",
                role="admin"
            )
            db.add(user)
            db.commit()

        # Check if already seeded
        existing_cust = db.query(Customer).filter(Customer.user_id == user.id).first()
        if existing_cust:
            print("CRM already seeded, refreshing sample data...")
            # We can retain or append
        
        # 1. Pipeline
        pipeline = db.query(CustomerPipeline).filter(CustomerPipeline.user_id == user.id).first()
        if not pipeline:
            pipeline = CustomerPipeline(
                id=generate_uuid(),
                user_id=user.id,
                name="Saadhyam Real Estate Pipeline",
                stages=[
                    {"id": "new_lead", "name": "New Lead", "color": "#3B82F6", "order": 1},
                    {"id": "contacted", "name": "Contacted", "color": "#8B5CF6", "order": 2},
                    {"id": "qualified", "name": "Qualified", "color": "#EC4899", "order": 3},
                    {"id": "interested", "name": "Interested", "color": "#F59E0B", "order": 4},
                    {"id": "proposal", "name": "Proposal Sent", "color": "#10B981", "order": 5},
                    {"id": "negotiation", "name": "Negotiation", "color": "#6366F1", "order": 6},
                    {"id": "won", "name": "Won", "color": "#059669", "order": 7, "is_won": True},
                    {"id": "lost", "name": "Lost", "color": "#EF4444", "order": 8, "is_lost": True},
                ],
                is_default=True
            )
            db.add(pipeline)
            db.commit()

        # 2. Main Hero Customer: Ravi Kumar (from the User's Specification!)
        ravi = db.query(Customer).filter(Customer.phone == "+91 98490 12345").first()
        if not ravi:
            ravi = Customer(
                id=generate_uuid(),
                user_id=user.id,
                name="Ravi Kumar",
                phone="+91 98490 12345",
                email="ravi.kumar@techcorp.in",
                company="TechCorp Solutions",
                source="Meta Ads",
                campaign="Luxury Villas Festive Launch",
                ad="Kakinada Coastline & City Villas",
                location="Kakinada",
                budget="₹80L – ₹1Cr",
                timeline="Within 2 months",
                interest="3BHK Villa in Kakinada",
                status="Interested",
                pipeline_stage="Interested",
                lead_score=88,
                assigned_user="Priya Sharma (Senior Sales Director)",
                assigned_agent="SARA Elite Real Estate Advisor",
                requirements=["3BHK Villa", "Location: Kakinada", "Gated Community", "East Facing"],
                preferences=["Clubhouse access", "Kids play zone", "Wide road access"],
                memory={
                    "consolidated_requirements": ["3BHK Villa", "Location: Kakinada", "Budget: ₹80L-₹1Cr", "EMI Financing Needed"],
                    "budget_range": "₹80 Lakhs – ₹1 Crore",
                    "preferred_locations": ["Kakinada", "Bhanugudi Junction"],
                    "timeline": "Within 2 months",
                    "objection_history": ["Wants better payment/EMI options"],
                    "commitments_log": [
                        {"promise": "Send available villas brochure via WhatsApp", "source": "Call 1", "timestamp": "23 Sep 2026, 10:28 AM"},
                        {"promise": "Coordinate bank home loan executive for EMI calculation", "source": "Call 1", "timestamp": "23 Sep 2026, 10:30 AM"}
                    ],
                    "last_updated": datetime.now(timezone.utc).isoformat()
                },
                last_interaction=get_utc_now() - timedelta(hours=2),
                next_followup=get_utc_now() + timedelta(days=1),
                created_at=get_utc_now() - timedelta(days=1)
            )
            db.add(ravi)
            db.commit()
            db.refresh(ravi)

            # Call Record for Ravi
            call_ravi = CallRecord(
                id=generate_uuid(),
                customer_id=ravi.id,
                user_id=user.id,
                caller="Ravi Kumar",
                receiver="SARA AI Voice Representative",
                phone_number="+91 98490 12345",
                direction="Inbound",
                call_type="AI Voice Call",
                start_time=get_utc_now() - timedelta(hours=2),
                end_time=get_utc_now() - timedelta(hours=1, minutes=57),
                duration_seconds=184,
                call_status="Completed"
            )
            db.add(call_ravi)
            db.commit()
            db.refresh(call_ravi)

            # Recording for Ravi
            rec_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server", "storage", "recordings", "ravi_kumar_call.wav")
            rec_ravi = CallRecording(
                id=generate_uuid(),
                call_id=call_ravi.id,
                customer_id=ravi.id,
                file_path=rec_file_path,
                file_name="ravi_kumar_call.wav",
                file_size_bytes=160044,
                mime_type="audio/wav",
                duration_seconds=184,
                transcription_status="Completed",
                analysis_status="Completed"
            )
            db.add(rec_ravi)

            # Diarized Transcripts for Ravi
            diarized_segments = [
                ("Agent", "SARA", 0.0, 4.2, "Namaskaram and welcome to ABC Properties! I am SARA. How may I assist you with our residential projects today?", "en", "Positive"),
                ("Customer", "Ravi Kumar", 4.5, 9.8, "Hello SARA, I saw your ad on Facebook about the villas in Kakinada. I am looking for a 3BHK.", "en", "Interested"),
                ("Agent", "SARA", 10.1, 15.6, "Wonderful! We have premium 3BHK independent villas starting in Kakinada with world-class amenities. May I know your expected budget range?", "en", "Positive"),
                ("Customer", "Ravi Kumar", 16.0, 21.4, "My budget is around 80 Lakhs to 1 Crore. Can we move in within 2 months?", "en", "Interested"),
                ("Agent", "SARA", 21.8, 28.5, "Yes, absolutely! We have ready-to-move-in and near-completion inventory well within 80 Lakhs to 1 Crore.", "en", "Positive"),
                ("Customer", "Ravi Kumar", 29.0, 36.2, "Are there flexible EMI options? I want good bank loan tie-ups with low interest.", "en", "Neutral"),
                ("Agent", "SARA", 36.6, 44.5, "Yes, we have pre-approved tie-ups with SBI and HDFC for up to 80% financing. I can send the brochure and site visit details to your WhatsApp.", "en", "Positive"),
                ("Customer", "Ravi Kumar", 45.0, 49.5, "Please send it over WhatsApp, and call me back tomorrow morning to fix the site visit.", "en", "Positive"),
                ("Agent", "SARA", 50.0, 56.0, "Done, Ravi garu! I have noted your preference for tomorrow. Thank you for choosing ABC Properties. Have a great day!", "en", "Positive")
            ]
            for spk, name, s_off, e_off, txt, lang, sent in diarized_segments:
                db.add(CallTranscript(
                    id=generate_uuid(),
                    call_id=call_ravi.id,
                    speaker=spk,
                    speaker_name=name,
                    start_time_offset=s_off,
                    end_time_offset=e_off,
                    text=txt,
                    language=lang,
                    sentiment=sent
                ))

            # Call Intelligence for Ravi
            intel_ravi = CallIntelligence(
                id=generate_uuid(),
                call_id=call_ravi.id,
                customer_id=ravi.id,
                customer_intent="Inquiring about 3BHK independent villa in Kakinada under ₹1 Crore",
                requirements=["3BHK Villa", "Kakinada location", "Ready to move within 2 months"],
                budget="₹80L – ₹1Cr",
                timeline="Within 2 months",
                objections=["Wants better payment & flexible EMI options"],
                questions=["Are there flexible EMI options?", "Can we move in within 2 months?"],
                competitors=[],
                sentiment="Interested",
                sentiment_score=0.92,
                purchase_intent="High",
                purchase_intent_score=0.95,
                promises=["Send brochure on WhatsApp", "Call tomorrow morning for site visit"],
                follow_up_needed=True,
                follow_up_reason="Customer explicitly asked for callback tomorrow to schedule site visit",
                follow_up_date=get_utc_now() + timedelta(days=1),
                next_recommended_action="Send available villas brochure and schedule site visit",
                call_summary="""CALL SUMMARY

Customer:
Ravi Kumar

Requirement:
3BHK villa in Kakinada

Budget:
₹80L–₹1Cr

Timeline:
Within 2 months

Interested:
Yes

Objection:
Wants better payment options

Next Action:
Send available villas and schedule site visit.

Follow-up:
Tomorrow morning"""
            )
            db.add(intel_ravi)

            # Activity Timeline matching exact user sequence in Section 12
            timeline_items = [
                ("call", "Follow-up Call Scheduled", "Callback arranged for tomorrow at 11:00 AM IST", "AI Agent", "SARA", get_utc_now() - timedelta(hours=1, minutes=30)),
                ("message", "Property Brochure Dispatched", "Dispatched 3BHK Kakinada Villa PDF catalog to WhatsApp (+91 98490 12345)", "AI Agent", "SARA WhatsApp Service", get_utc_now() - timedelta(hours=1, minutes=45)),
                ("workflow_action", "Customer Marked 'Interested'", "Stage automatically progressed to Interested based on AI call qualification score (92%)", "System", "Saadhyam Auto-Stage Engine", get_utc_now() - timedelta(hours=1, minutes=50)),
                ("ai_action", "AI Analysis Completed", "Extracted 3BHK requirement, budget ₹80L-₹1Cr, timeline 2 months, and EMI objection", "AI Agent", "Saadhyam Conversation Intelligence", get_utc_now() - timedelta(hours=1, minutes=55)),
                ("call", "Call Recording Stored & Transcribed", "184-second audio recording securely encrypted and speaker-diarized", "System", "Secure Media Storage", get_utc_now() - timedelta(hours=1, minutes=57)),
                ("call", "Inbound Call Handled by SARA", "Customer discussed 3BHK villa options in Kakinada", "AI Agent", "SARA", get_utc_now() - timedelta(hours=2)),
                ("human_action", "Lead Created from Meta Ads", "Inquiry captured from 'Luxury Villas Festive Launch' ad campaign", "System", "Meta Ads Webhook", get_utc_now() - timedelta(days=1))
            ]
            for act_type, title, desc, actor_type, actor_name, ts in timeline_items:
                db.add(ActivityTimeline(
                    id=generate_uuid(),
                    customer_id=ravi.id,
                    user_id=user.id,
                    activity_type=act_type,
                    title=title,
                    description=desc,
                    actor_type=actor_type,
                    actor_name=actor_name,
                    source="CRM",
                    status="Completed",
                    timestamp=ts
                ))

            # Task for Ravi
            task_ravi = CRMTask(
                id=generate_uuid(),
                customer_id=ravi.id,
                user_id=user.id,
                title="Follow-up Call & Site Visit Scheduling",
                description="Call Ravi Kumar to finalize site visit timing for 3BHK Kakinada project and review EMI calculations.",
                task_type="Callback",
                priority="High",
                status="Pending",
                due_date=get_utc_now() + timedelta(days=1),
                assigned_to="Priya Sharma (Senior Sales Director)",
                is_ai_generated=True,
                trigger_reason="Customer requested callback during AI call",
                created_at=get_utc_now() - timedelta(hours=1)
            )
            db.add(task_ravi)

            # Deal for Ravi
            deal_ravi = Deal(
                id=generate_uuid(),
                customer_id=ravi.id,
                user_id=user.id,
                name="Ravi Kumar — 3BHK Kakinada Luxury Villa",
                amount=9500000.0,
                currency="INR",
                stage="Qualified",
                probability=75,
                expected_close_date=get_utc_now() + timedelta(days=45),
                notes="Customer has high purchase intent. Prefers east-facing plot."
            )
            db.add(deal_ravi)

        # 3. Additional Diverse Customers
        extra_customers = [
            {
                "name": "Ananya Desai",
                "phone": "+91 97012 34567",
                "email": "ananya.d@nexuscapital.com",
                "company": "Nexus Capital",
                "source": "Meta Ads",
                "location": "Kokapet, Hyderabad",
                "budget": "₹2.5 – ₹3.2 Crore",
                "timeline": "Immediate (Within 30 days)",
                "interest": "Ultra-Luxury 4BHK Penthouse",
                "status": "Proposal Sent",
                "pipeline_stage": "Proposal Sent",
                "lead_score": 94,
                "assigned_user": "Priya Sharma (Senior Sales Director)",
                "assigned_agent": "SARA Elite Real Estate Advisor",
                "requirements": ["4BHK Penthouse", "Kokapet", "Private Terrace", "3 Car Parks"],
                "deal_amt": 28000000.0
            },
            {
                "name": "Venkat Rao",
                "phone": "+91 94401 88765",
                "email": "venkat.rao@hydengg.org",
                "company": "Hyderabad Engineering Works",
                "source": "Google Ads",
                "location": "Gachibowli, Hyderabad",
                "budget": "₹65 – ₹80 Lakhs",
                "timeline": "3 to 6 months",
                "interest": "Gated Community Residential Plot",
                "status": "Contacted",
                "pipeline_stage": "Contacted",
                "lead_score": 68,
                "assigned_user": "Vikram Reddy (Hyderabad Prime Sales)",
                "assigned_agent": "SARA",
                "requirements": ["Residential Plot 200-300 Sq Yards", "HMDA Approved"],
                "deal_amt": 7500000.0
            },
            {
                "name": "Sneha Reddy",
                "phone": "+91 88865 44321",
                "email": "sneha.reddy@gmail.com",
                "company": "Infosys",
                "source": "WhatsApp",
                "location": "Kondapur, Hyderabad",
                "budget": "₹85 – ₹95 Lakhs",
                "timeline": "1 month",
                "interest": "2BHK High-rise Apartment",
                "status": "Qualified",
                "pipeline_stage": "Qualified",
                "lead_score": 82,
                "assigned_user": "Vikram Reddy (Hyderabad Prime Sales)",
                "assigned_agent": "SARA",
                "requirements": ["2BHK High-rise", "Kondapur", "Gym & Pool"],
                "deal_amt": 8800000.0
            },
            {
                "name": "Rajesh Gupta",
                "phone": "+91 99887 66554",
                "email": "rajesh@guptagroup.com",
                "company": "Gupta Retail Enterprises",
                "source": "Website",
                "location": "Financial District, Hyderabad",
                "budget": "₹3.5 Crore",
                "timeline": "Closed",
                "interest": "Commercial Retail Unit",
                "status": "Won",
                "pipeline_stage": "Won",
                "lead_score": 99,
                "assigned_user": "Priya Sharma (Senior Sales Director)",
                "assigned_agent": "SARA Elite Real Estate Advisor",
                "requirements": ["Commercial High Street", "Ground Floor"],
                "deal_amt": 35000000.0
            }
        ]

        for item in extra_customers:
            c_exist = db.query(Customer).filter(Customer.phone == item["phone"]).first()
            if not c_exist:
                cust = Customer(
                    id=generate_uuid(),
                    user_id=user.id,
                    name=item["name"],
                    phone=item["phone"],
                    email=item["email"],
                    company=item["company"],
                    source=item["source"],
                    location=item["location"],
                    budget=item["budget"],
                    timeline=item["timeline"],
                    interest=item["interest"],
                    status=item["status"],
                    pipeline_stage=item["pipeline_stage"],
                    lead_score=item["lead_score"],
                    assigned_user=item["assigned_user"],
                    assigned_agent=item["assigned_agent"],
                    requirements=item["requirements"],
                    last_interaction=get_utc_now() - timedelta(days=1),
                    created_at=get_utc_now() - timedelta(days=3)
                )
                db.add(cust)
                db.commit()
                db.refresh(cust)

                # Deal
                deal = Deal(
                    id=generate_uuid(),
                    customer_id=cust.id,
                    user_id=user.id,
                    name=f"{cust.name} — {cust.interest}",
                    amount=item["deal_amt"],
                    currency="INR",
                    stage=cust.pipeline_stage,
                    probability=90 if cust.pipeline_stage == "Won" else 60,
                    expected_close_date=get_utc_now() + timedelta(days=30)
                )
                db.add(deal)

                # Timeline
                db.add(ActivityTimeline(
                    id=generate_uuid(),
                    customer_id=cust.id,
                    user_id=user.id,
                    activity_type="workflow_action",
                    title=f"Lead Created from {cust.source}",
                    description=f"Inquired about {cust.interest}",
                    actor_type="System",
                    actor_name="CRM Ingest",
                    source="Direct",
                    status="Completed",
                    timestamp=get_utc_now() - timedelta(days=2)
                ))

        db.commit()
        print("Saadhyam CRM seeded successfully with realistic customers, calls, recordings, and intelligence!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding CRM: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed()
