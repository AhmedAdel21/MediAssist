import pytest
from httpx import AsyncClient

from auth.models import UserRole
from authz.policies import PolicyEngine

pytestmark = pytest.mark.asyncio

policy = PolicyEngine()


class _FakeUser:
    def __init__(self, role: UserRole, user_id: str = "user-1"):
        self.role = role
        self.id = user_id
        self.is_active = True


class TestDocumentPolicy:
    def test_admin_passes_all_roles(self):
        admin = _FakeUser(UserRole.ADMIN)
        assert policy.check_role(admin, UserRole.DOCTOR)
        assert policy.check_role(admin, UserRole.NURSE)

    def test_doctor_passes_doctor_role(self):
        doctor = _FakeUser(UserRole.DOCTOR)
        assert policy.check_role(doctor, UserRole.DOCTOR)

    def test_nurse_fails_doctor_only_role(self):
        nurse = _FakeUser(UserRole.NURSE)
        assert not policy.check_role(nurse, UserRole.DOCTOR)

    def test_doctor_passes_medical_staff(self):
        doctor = _FakeUser(UserRole.DOCTOR)
        assert policy.check_role(doctor, UserRole.DOCTOR, UserRole.NURSE)

    def test_nurse_passes_medical_staff(self):
        nurse = _FakeUser(UserRole.NURSE)
        assert policy.check_role(nurse, UserRole.DOCTOR, UserRole.NURSE)

    def test_doctor_owns_document(self):
        doctor = _FakeUser(UserRole.DOCTOR, user_id="doc-1")
        assert policy.check_owns_document(doctor, "doc-1")

    def test_doctor_does_not_own_other_document(self):
        doctor = _FakeUser(UserRole.DOCTOR, user_id="doc-1")
        assert not policy.check_owns_document(doctor, "doc-2")

    def test_admin_owns_any_document(self):
        admin = _FakeUser(UserRole.ADMIN, user_id="admin-1")
        assert policy.check_owns_document(admin, "doc-2")


class TestPatientRecordPolicy:
    def test_assigned_nurse_has_access(self):
        nurse = _FakeUser(UserRole.NURSE, user_id="nurse-1")
        assert policy.check_nurse_patient_access(nurse, ["nurse-1", "nurse-2"])

    def test_unassigned_nurse_denied(self):
        nurse = _FakeUser(UserRole.NURSE, user_id="nurse-3")
        assert not policy.check_nurse_patient_access(nurse, ["nurse-1", "nurse-2"])

    def test_doctor_always_has_access(self):
        doctor = _FakeUser(UserRole.DOCTOR)
        assert policy.check_nurse_patient_access(doctor, [])

    def test_admin_always_has_access(self):
        admin = _FakeUser(UserRole.ADMIN)
        assert policy.check_nurse_patient_access(admin, [])

    def test_patient_role_denied(self):
        patient = _FakeUser(UserRole.PATIENT)
        assert not policy.check_nurse_patient_access(patient, ["patient-1"])


async def test_health_check(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
