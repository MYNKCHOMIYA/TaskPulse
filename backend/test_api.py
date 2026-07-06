import httpx
import asyncio

async def test_api():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Create a user
        res = await client.post("/auth/login", data={"username": "test@example.com", "password": "password"})
        if res.status_code != 200:
            # Maybe user doesn't exist, try to sign up
            await client.post("/users/create", json={"username": "test", "email": "test@example.com", "password": "password"})
            res = await client.post("/auth/login", data={"username": "test@example.com", "password": "password"})
        
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print("1. Fetching tasks...")
        res = await client.get("/tasks/", headers=headers) # Using trailing slash
        print(f"Status: {res.status_code}")
        
        print("2. Fetching tasks without trailing slash...")
        res = await client.get("/tasks", headers=headers)
        print(f"Status: {res.status_code}")
        
        if res.status_code != 200:
            print(res.text)

asyncio.run(test_api())
