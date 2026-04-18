from fastapi import Depends, HTTPException, status

from auth.dependencies import get_current_user
from auth.models import User, UserRole


class PolicyEngine:
    """
    Unified policy engine supporting RBAC, ABAC, and ReBAC.
    Admins bypass all checks.
    """

    @staticmethod
    def is_admin(user: User) -> bool:
        return user.role == UserRole.ADMIN

    # RBAC checks

    @staticmethod
    def check_role(user: User, *roles: UserRole) -> bool:
        if PolicyEngine.is_admin(user):
            return True
        return user.role in roles

    @staticmethod
    def assert_role(user: User, *roles: UserRole) -> None:
        if not PolicyEngine.check_role(user, *roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access requires one of: {', '.join(r.value for r in roles)}",
            )

    # ABAC checks — attribute-based on resource ownership

    @staticmethod
    def check_owns_document(user: User, owner_id: str) -> bool:
        if PolicyEngine.is_admin(user):
            return True
        return user.id == owner_id

    @staticmethod
    def assert_owns_document(user: User, owner_id: str) -> None:
        if not PolicyEngine.check_owns_document(user, owner_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own documents",
            )

    # ReBAC checks — relationship-based

    @staticmethod
    def check_nurse_patient_access(nurse: User, assigned_nurse_ids: list[str]) -> bool:
        if PolicyEngine.is_admin(nurse):
            return True
        if nurse.role == UserRole.DOCTOR:
            return True
        if nurse.role == UserRole.NURSE:
            return nurse.id in assigned_nurse_ids
        return False

    @staticmethod
    def assert_nurse_patient_access(nurse: User, assigned_nurse_ids: list[str]) -> None:
        if not PolicyEngine.check_nurse_patient_access(nurse, assigned_nurse_ids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nurse does not have access to this patient record",
            )


policy_engine = PolicyEngine()


# FastAPI dependency shortcuts for RBAC

def require_doctor(current_user: User = Depends(get_current_user)) -> User:
    policy_engine.assert_role(current_user, UserRole.DOCTOR)
    return current_user


def require_medical_staff(current_user: User = Depends(get_current_user)) -> User:
    policy_engine.assert_role(current_user, UserRole.DOCTOR, UserRole.NURSE)
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
