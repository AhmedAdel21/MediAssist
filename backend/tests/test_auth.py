import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


DOCTOR_DATA = {
    "email": "doctor@test.com",
    "full_name": "Dr. House",
    "password": "SecurePass1",
    "role": "doctor",
}

NURSE_DATA = {
    "email": "nurse@test.com",
    "full_name": "Nurse Joy",
    "password": "SecurePass1",
    "role": "nurse",
}

ADMIN_DATA = {
    "email": "admin@test.com",
    "full_name": "Admin User",
    "password": "SecurePass1",
    "role": "admin",
}


async def register_and_login(client: AsyncClient, data: dict) -> str:
    await client.post("/api/v1/auth/register", json=data)
    resp = await client.post("/api/v1/auth/login", json={"email": data["email"], "password": data["password"]})
    return resp.json()["access_token"]


async def test_register_success(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json=DOCTOR_DATA)
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == DOCTOR_DATA["email"]
    assert "hashed_password" not in body


async def test_register_invalid_email(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/register",
        json={**DOCTOR_DATA, "email": "not-an-email"},
    )
    assert resp.status_code == 422


async def test_register_weak_password(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/register",
        json={**DOCTOR_DATA, "password": "lowercase1"},
    )
    assert resp.status_code == 422
    detail = str(resp.json())
    assert "uppercase" in detail.lower()


async def test_register_duplicate_email(client: AsyncClient):
    await client.post("/api/v1/auth/register", json=DOCTOR_DATA)
    resp = await client.post("/api/v1/auth/register", json=DOCTOR_DATA)
    assert resp.status_code == 409


async def test_login_success(client: AsyncClient):
    await client.post("/api/v1/auth/register", json=DOCTOR_DATA)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": DOCTOR_DATA["email"], "password": DOCTOR_DATA["password"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body


async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/v1/auth/register", json=DOCTOR_DATA)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": DOCTOR_DATA["email"], "password": "WrongPass9"},
    )
    assert resp.status_code == 401


async def test_get_me_authenticated(client: AsyncClient):
    token = await register_and_login(client, DOCTOR_DATA)
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "doctor"


async def test_get_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 403


async def test_nurse_cannot_upload_document(client: AsyncClient):
    token = await register_and_login(client, NURSE_DATA)
    resp = await client.post(
        "/api/v1/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("test.txt", b"hello world", "text/plain")},
    )
    assert resp.status_code == 403


async def test_doctor_cannot_access_admin(client: AsyncClient):
    token = await register_and_login(client, DOCTOR_DATA)
    resp = await client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


async def test_admin_can_list_users(client: AsyncClient):
    token = await register_and_login(client, ADMIN_DATA)
    resp = await client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert isinstance(body["items"], list)
