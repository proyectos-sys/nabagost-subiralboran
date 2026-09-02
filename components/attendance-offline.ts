export type PendingAttendanceAction = {
  idempotencyKey: string;
  employeeId: number;
  employeeName: string;
  action: "check-in" | "check-out";
  occurredAt: string;
  createdAt: string;
};

const DB_NAME = "navagost-tablet";
const DB_VERSION = 1;
const STORE_NAME = "pending-attendance";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "idempotencyKey" });
        store.createIndex("createdAt", "createdAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingAttendance(action: PendingAttendanceAction) {
  const db = await openDatabase();
  await transaction(db, "readwrite", (store) => store.put(action));
  db.close();
}

export async function deletePendingAttendance(idempotencyKey: string) {
  const db = await openDatabase();
  await transaction(db, "readwrite", (store) => store.delete(idempotencyKey));
  db.close();
}

export async function listPendingAttendance(): Promise<PendingAttendanceAction[]> {
  const db = await openDatabase();
  const items = await transaction<PendingAttendanceAction[]>(db, "readonly", (store) => store.getAll());
  db.close();

  return items.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function countPendingAttendance(): Promise<number> {
  const db = await openDatabase();
  const count = await transaction<number>(db, "readonly", (store) => store.count());
  db.close();

  return count;
}

function transaction<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | IDBRequest<IDBValidKey>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}
