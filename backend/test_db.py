from app.database import test_connection

try:
    result = test_connection()
    print("Conexión correcta:")
    print(result)
except Exception as e:
    print("Error conectando a SQL Server:")
    print(e)