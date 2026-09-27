"""
SARA AI — RBAC Permission System

Role hierarchy:
    OWNER > ADMIN > MANAGER > AI_MANAGER > MEMBER > VIEWER

Each role inherits all permissions of roles below it.
"""
from enum import Enum
from typing import Set, Dict


class Role(str, Enum):
    OWNER      = "owner"
    ADMIN      = "admin"
    MANAGER    = "manager"
    AI_MANAGER = "ai_manager"
    MEMBER     = "member"
    VIEWER     = "viewer"


class Permission(str, Enum):
    # AI Employees
    EMPLOYEE_CREATE   = "employee:create"
    EMPLOYEE_READ     = "employee:read"
    EMPLOYEE_UPDATE   = "employee:update"
    EMPLOYEE_DELETE   = "employee:delete"
    EMPLOYEE_TRAIN    = "employee:train"
    EMPLOYEE_ACTIVATE = "employee:activate"

    # Teams
    TEAM_CREATE = "team:create"
    TEAM_READ   = "team:read"
    TEAM_UPDATE = "team:update"
    TEAM_DELETE = "team:delete"

    # Tasks
    TASK_CREATE  = "task:create"
    TASK_READ    = "task:read"
    TASK_ASSIGN  = "task:assign"
    TASK_APPROVE = "task:approve"
    TASK_DELETE  = "task:delete"

    # Workflows
    WORKFLOW_CREATE  = "workflow:create"
    WORKFLOW_READ    = "workflow:read"
    WORKFLOW_EXECUTE = "workflow:execute"
    WORKFLOW_DELETE  = "workflow:delete"

    # CRM
    CRM_READ   = "crm:read"
    CRM_WRITE  = "crm:write"
    CRM_DELETE = "crm:delete"

    # Leads
    LEAD_READ   = "lead:read"
    LEAD_WRITE  = "lead:write"
    LEAD_DELETE = "lead:delete"

    # Calls
    CALL_MAKE    = "calls:make"
    CALL_RECEIVE = "calls:receive"
    CALL_READ    = "calls:read"

    # Campaigns
    CAMPAIGN_CREATE = "campaign:create"
    CAMPAIGN_READ   = "campaign:read"
    CAMPAIGN_RUN    = "campaign:run"

    # Knowledge
    KNOWLEDGE_READ   = "knowledge:read"
    KNOWLEDGE_WRITE  = "knowledge:write"
    KNOWLEDGE_DELETE = "knowledge:delete"

    # Integrations
    INTEGRATION_CONNECT = "integration:connect"
    INTEGRATION_MANAGE  = "integration:manage"

    # Approvals
    APPROVAL_READ    = "approval:read"
    APPROVAL_APPROVE = "approval:approve"
    APPROVAL_REJECT  = "approval:reject"

    # Analytics
    ANALYTICS_READ = "analytics:read"

    # Billing
    BILLING_READ   = "billing:read"
    BILLING_MANAGE = "billing:manage"

    # Settings
    SETTINGS_READ  = "settings:read"
    SETTINGS_WRITE = "settings:write"

    # Members
    MEMBER_INVITE = "member:invite"
    MEMBER_MANAGE = "member:manage"

    # Audit
    AUDIT_READ = "audit:read"

    # Workspace admin
    WORKSPACE_MANAGE = "workspace:manage"


# ── Permission sets per role ────────────────────────────────────────────────

_VIEWER_PERMS: Set[Permission] = {
    Permission.EMPLOYEE_READ,
    Permission.TEAM_READ,
    Permission.TASK_READ,
    Permission.WORKFLOW_READ,
    Permission.CRM_READ,
    Permission.LEAD_READ,
    Permission.CALL_READ,
    Permission.CAMPAIGN_READ,
    Permission.KNOWLEDGE_READ,
    Permission.ANALYTICS_READ,
    Permission.BILLING_READ,
    Permission.SETTINGS_READ,
    Permission.APPROVAL_READ,
    Permission.AUDIT_READ,
}

_MEMBER_PERMS: Set[Permission] = _VIEWER_PERMS | {
    Permission.TASK_CREATE,
    Permission.LEAD_WRITE,
    Permission.CRM_WRITE,
    Permission.CALL_MAKE,
    Permission.CALL_RECEIVE,
    Permission.KNOWLEDGE_WRITE,
}

_AI_MANAGER_PERMS: Set[Permission] = _MEMBER_PERMS | {
    Permission.EMPLOYEE_CREATE,
    Permission.EMPLOYEE_UPDATE,
    Permission.EMPLOYEE_TRAIN,
    Permission.EMPLOYEE_ACTIVATE,
    Permission.TEAM_CREATE,
    Permission.TEAM_UPDATE,
    Permission.WORKFLOW_CREATE,
    Permission.WORKFLOW_EXECUTE,
    Permission.TASK_ASSIGN,
    Permission.CAMPAIGN_CREATE,
    Permission.CAMPAIGN_RUN,
    Permission.INTEGRATION_CONNECT,
    Permission.APPROVAL_APPROVE,
    Permission.APPROVAL_REJECT,
}

_MANAGER_PERMS: Set[Permission] = _AI_MANAGER_PERMS | {
    Permission.EMPLOYEE_DELETE,
    Permission.TEAM_DELETE,
    Permission.WORKFLOW_DELETE,
    Permission.TASK_APPROVE,
    Permission.TASK_DELETE,
    Permission.LEAD_DELETE,
    Permission.CRM_DELETE,
    Permission.CAMPAIGN_CREATE,
    Permission.INTEGRATION_MANAGE,
    Permission.MEMBER_INVITE,
    Permission.BILLING_MANAGE,
    Permission.SETTINGS_WRITE,
    Permission.KNOWLEDGE_DELETE,
}

_ADMIN_PERMS: Set[Permission] = _MANAGER_PERMS | {
    Permission.MEMBER_MANAGE,
    Permission.WORKSPACE_MANAGE,
}

_OWNER_PERMS: Set[Permission] = set(Permission)  # All permissions

ROLE_PERMISSIONS: Dict[Role, Set[Permission]] = {
    Role.OWNER:      _OWNER_PERMS,
    Role.ADMIN:      _ADMIN_PERMS,
    Role.MANAGER:    _MANAGER_PERMS,
    Role.AI_MANAGER: _AI_MANAGER_PERMS,
    Role.MEMBER:     _MEMBER_PERMS,
    Role.VIEWER:     _VIEWER_PERMS,
}


def has_permission(role: str, permission: Permission) -> bool:
    """Check if a role has a given permission."""
    try:
        r = Role(role.lower())
        return permission in ROLE_PERMISSIONS.get(r, set())
    except ValueError:
        return False


def get_role_permissions(role: str) -> Set[Permission]:
    """Return the complete permission set for a role."""
    try:
        r = Role(role.lower())
        return ROLE_PERMISSIONS.get(r, set())
    except ValueError:
        return set()
