import pyodbc

from app.config import settings


def get_connection():
    """
    Crea conexión a SQL Server con timeout corto para evitar que el backend
    se quede cargando indefinidamente.
    """

    server = getattr(settings, "DB_SERVER", "localhost")
    database = getattr(settings, "DB_NAME", "ClaroAtencion360")
    username = getattr(settings, "DB_USER", "")
    password = getattr(settings, "DB_PASSWORD", "")
    driver = getattr(settings, "DB_DRIVER", "ODBC Driver 17 for SQL Server")
    trusted_connection = getattr(settings, "DB_TRUSTED_CONNECTION", "yes")

    if username and password:
        connection_string = (
            f"DRIVER={{{driver}}};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"UID={username};"
            f"PWD={password};"
            f"TrustServerCertificate=yes;"
            f"Connection Timeout=5;"
        )
    else:
        connection_string = (
            f"DRIVER={{{driver}}};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"Trusted_Connection={trusted_connection};"
            f"TrustServerCertificate=yes;"
            f"Connection Timeout=5;"
        )

    conn = pyodbc.connect(connection_string, timeout=5)
    conn.timeout = 15
    return conn


def row_to_dict(cursor, row):
    if row is None:
        return None

    columns = [column[0] for column in cursor.description]
    return dict(zip(columns, row))


def fetch_one(query: str, params: tuple = ()):
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)

        row = cursor.fetchone()

        if row is None:
            return None

        return row_to_dict(cursor, row)

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def fetch_all(query: str, params: tuple = ()):
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)

        rows = cursor.fetchall()

        if not rows:
            return []

        columns = [column[0] for column in cursor.description]

        return [
            dict(zip(columns, row))
            for row in rows
        ]

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def execute(query: str, params: tuple = ()):
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()

        return cursor.rowcount

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def execute_identity(query: str, params: tuple = ()):
    """
    Ejecuta un INSERT y devuelve el ID generado.
    Útil para registros nuevos.
    """
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        cursor.execute("SELECT SCOPE_IDENTITY() AS new_id;")
        row = cursor.fetchone()
        conn.commit()

        if row:
            return int(row[0])

        return None

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def test_connection():
    row = fetch_one("SELECT DB_NAME() AS database_name, SYSDATETIME() AS server_time")
    return row