import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("83.217.203.41", username="root", password="rA3US@@R5Kg4e6")

print("=== Test forgot-password ===")
stdin, stdout, stderr = client.exec_command("curl -s -X POST https://vidial-media.ru/api/auth/forgot-password -H 'Content-Type: application/json' -d '{\"email\": \"test@example.com\"}'")
out = stdout.read().decode()
print("Response:", out)

print("=== Recent logs ===")
stdin, stdout, stderr = client.exec_command("docker logs --tail 20 superglazka-backend 2>&1")
out = stdout.read().decode()
print(out)

print("=== FROM_EMAIL ===")
stdin, stdout, stderr = client.exec_command("docker exec superglazka-backend node -e 'console.log(process.env.FROM_EMAIL)'")
out = stdout.read().decode()
print("FROM_EMAIL:", out.strip())

print("=== RESEND_API_KEY prefix ===")
stdin, stdout, stderr = client.exec_command("docker exec superglazka-backend node -e 'console.log(process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.slice(0,6) : \"empty\")'")
out = stdout.read().decode()
print("RESEND_API_KEY:", out.strip())

client.close()
