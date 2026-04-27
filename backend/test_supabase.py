
import asyncio
import os
from supabase import acreate_client, AsyncClient
from dotenv import load_dotenv

load_dotenv()

async def test_conn():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    
    print(f"Testing connection to: {url}")
    try:
        supabase: AsyncClient = await acreate_client(url, key)
        res = await supabase.table("profiles").select("*").limit(1).execute()
        print("Successfully connected to Supabase!")
        print(f"Sample data: {res.data}")
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
