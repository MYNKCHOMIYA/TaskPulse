import pytest

def test_task_crud_and_analytics_lifecycle(client, auth_header, sample_task):

    create_res = client.post("tasks/create", json=sample_task, headers=auth_header)
    assert create_res.status_code ==201
    task_id = create_res.json()["id"]
    
    get_all_res = client.get("/tasks/?search=gym&skip=0&limit=5",headers=auth_header)
    assert get_all_res.status_code == 200
    assert len(get_all_res.json()["tasks"]) == 1
    assert get_all_res.json()["tasks"][0]["title"] == "gym"
    
    get_one_res = client.get(f"/tasks/{task_id}", headers=auth_header)
    assert get_one_res.status_code ==200
    assert get_one_res.json()["description"] == "do it now"
    
    patch_payload = {"status": "COMPLETED", "description": "workout accomplished"}
    patch_res = client.patch(f"/tasks/update/{task_id}", json=patch_payload, headers=auth_header)
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "COMPLETED"
    assert patch_res.json()["description"] == "workout accomplished"
    
    analytics_res = client.get("/Analytics/count", headers=auth_header)
    assert analytics_res.status_code == 200
    assert analytics_res.json()["total_tasks"] == 1
    assert analytics_res.json()["by_status"]["COMPLETED"] == 1
    
    delete_res = client.delete(f"/tasks/delete/{task_id}", headers=auth_header)
    assert delete_res.status_code in [200, 204]
    
    verify_delete_res = client.get(f"/tasks/{task_id}", headers=auth_header)
    assert verify_delete_res.status_code == 404