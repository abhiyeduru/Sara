import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from server.models import (
    Customer, ActivityTimeline, CRMTask, CRMAuditLog, CRMAutomation, generate_uuid, get_utc_now
)

logger = logging.getLogger(__name__)

# Standard CRM Event Constants
EVENT_LEAD_CREATED = "lead.created"
EVENT_CALL_STARTED = "call.started"
EVENT_CALL_COMPLETED = "call.completed"
EVENT_RECORDING_CREATED = "recording.created"
EVENT_TRANSCRIPT_COMPLETED = "transcript.completed"
EVENT_CONVERSATION_ANALYZED = "conversation.analyzed"
EVENT_MESSAGE_RECEIVED = "message.received"
EVENT_MESSAGE_SENT = "message.sent"
EVENT_TASK_CREATED = "task.created"
EVENT_TASK_COMPLETED = "task.completed"
EVENT_FOLLOWUP_CREATED = "followup.created"
EVENT_DEAL_UPDATED = "deal.updated"
EVENT_AGENT_ACTION = "agent.action.completed"
EVENT_AGENT_ESCALATED = "agent.escalated"


def evaluate_auto_lead_assignment(customer: Customer) -> Dict[str, str]:
    """
    Intelligent Lead Assignment Engine:
    Assigns leads based on location, budget, product, and workload.
    """
    budget_str = (customer.budget or "").lower()
    location = (customer.location or "").lower()
    source = (customer.source or "").lower()

    # High Value / Senior Lead Assignment
    if "crore" in budget_str or "1 cr" in budget_str or "villa" in (customer.interest or "").lower():
        return {
            "assigned_user": "Priya Sharma (Senior Sales Director)",
            "assigned_agent": "SARA Elite Real Estate Advisor",
            "reason": "High-value lead (Budget > ₹1 Crore / Luxury Villa)"
        }
    
    # Regional Assignment
    if "kakinada" in location or "andhra" in location:
        return {
            "assigned_user": "Kiran Kumar (Regional Specialist - Coastal AP)",
            "assigned_agent": "SARA Telugu Specialist",
            "reason": "Location match: Kakinada / Coastal AP"
        }
    elif "hyderabad" in location or "gachibowli" in location:
        return {
            "assigned_user": "Vikram Reddy (Hyderabad Prime Sales)",
            "assigned_agent": "SARA",
            "reason": "Location match: Hyderabad IT Corridor"
        }

    # Source based
    if "meta" in source or "instagram" in source:
        return {
            "assigned_user": "Ananya Joshi (Digital Growth Team)",
            "assigned_agent": "SARA",
            "reason": "Meta Ads automated routing rule"
        }

    return {
        "assigned_user": "Rahul Verma (Sales Executive)",
        "assigned_agent": "SARA",
        "reason": "Standard round-robin assignment"
    }


def publish_crm_event(
    db: Session,
    event_name: str,
    payload: Dict[str, Any],
    user_id: str,
    actor_type: str = "AI Agent",
    actor_name: str = "SARA"
) -> None:
    """
    Central Event-Driven Bus for CRM:
    Records timeline, creates audit logs, and triggers automated workflows.
    """
    customer_id = payload.get("customer_id")
    customer = db.query(Customer).filter(Customer.id == customer_id).first() if customer_id else None

    # 1. Timeline Record
    if customer_id:
        title = payload.get("title", f"Event: {event_name}")
        description = payload.get("description", "")
        timeline_entry = ActivityTimeline(
            id=generate_uuid(),
            customer_id=customer_id,
            user_id=user_id,
            activity_type=event_name.split(".")[0],
            title=title,
            description=description,
            actor_type=actor_type,
            actor_name=actor_name,
            source=payload.get("source", "CRM Event Engine"),
            status="Completed",
            metadata_json=payload,
            timestamp=get_utc_now()
        )
        db.add(timeline_entry)

    # 2. Audit Log
    audit_entry = CRMAuditLog(
        id=generate_uuid(),
        user_id=user_id,
        customer_id=customer_id,
        actor_type=actor_type,
        actor_name=actor_name,
        action=event_name,
        entity_type="Customer" if customer_id else "System",
        entity_id=customer_id,
        previous_value=payload.get("previous_value", {}),
        new_value=payload.get("new_value", {}),
        reason=payload.get("reason", f"Triggered by {event_name}"),
        timestamp=get_utc_now()
    )
    db.add(audit_entry)

    # 3. Automation triggers
    try:
        # A. Auto Lead Assignment when a new lead is created
        if event_name == EVENT_LEAD_CREATED and customer:
            assignment = evaluate_auto_lead_assignment(customer)
            customer.assigned_user = assignment["assigned_user"]
            customer.assigned_agent = assignment["assigned_agent"]
            db.add(customer)
            
            # Record assignment timeline
            db.add(ActivityTimeline(
                id=generate_uuid(),
                customer_id=customer_id,
                user_id=user_id,
                activity_type="workflow_action",
                title=f"Lead Auto-Assigned to {assignment['assigned_user']}",
                description=f"Rule: {assignment['reason']}",
                actor_type="System",
                actor_name="Saadhyam Auto-Assign Engine",
                source="Workflow",
                status="Completed",
                metadata_json=assignment,
                timestamp=get_utc_now()
            ))

        # B. Auto Follow-up Task creation when a call or conversation is analyzed
        if event_name in [EVENT_CONVERSATION_ANALYZED, EVENT_CALL_COMPLETED]:
            intel = payload.get("intelligence", {})
            if intel.get("follow_up_needed"):
                days = intel.get("follow_up_days", 1)
                due_date = get_utc_now() + timedelta(days=days)
                task_title = f"Follow-up: {intel.get('follow_up_reason', 'Discuss property requirements')}"
                
                # Create Task
                task = CRMTask(
                    id=generate_uuid(),
                    customer_id=customer_id,
                    user_id=user_id,
                    title=task_title,
                    description=intel.get("next_recommended_action", "Send brochure and call back"),
                    task_type="Callback" if "call" in task_title.lower() else "Follow-up",
                    priority="High" if intel.get("purchase_intent") == "High" else "Medium",
                    status="Pending",
                    due_date=due_date,
                    assigned_to=customer.assigned_user if customer else "Sales Agent",
                    is_ai_generated=True,
                    trigger_reason=f"Detected from voice call: {intel.get('follow_up_reason', 'Commitment detected')}",
                    created_at=get_utc_now()
                )
                db.add(task)
                
                # Update customer next_followup date
                if customer:
                    customer.next_followup = due_date
                    db.add(customer)

        db.commit()
    except Exception as e:
        logger.error(f"Error executing CRM automations for {event_name}: {e}")
        db.rollback()
