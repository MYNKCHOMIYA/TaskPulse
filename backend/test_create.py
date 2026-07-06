import requests

url = "http://127.0.0.1:8000/tasks/create"
headers = {
    "Authorization": "Bearer TEST", 
    "Content-Type": "application/json"
}
data = {
    "title": "Test Task",
    "description": "Test Desc",
    "status": "PENDING",
    "priority": "LOW"
}
try:
    res = requests.post(url, json=data)
    print(res.status_code)
    print(res.text)
except Exception as e:
    print(e)
