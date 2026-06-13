/**
 * 貸し出し履歴テストデータ 50 件を Supabase に投入する。
 * 実行: node scripts/insert_lending_history_testdata_50.js
 */
const SUPABASE_URL = "https://bpfytlurmubgmzaisonp.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZnl0bHVybXViZ216YWlzb25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2OTA2MzUsImV4cCI6MjA5NTI2NjYzNX0.rIimKp_spSxCuuKCJlFoa8ux4BvFodHam0S3XGTFRa0";

const HEADERS = {
  apikey: ANON_KEY,
  Authorization: "Bearer " + ANON_KEY,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function fetchJson(path) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, { headers: HEADERS });
  if (!res.ok) throw new Error(path + " " + res.status + " " + (await res.text()));
  return res.json();
}

async function insertRows(rows) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/libraly_app_lending_history", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error("INSERT " + res.status + " " + (await res.text()));
}

function toTokyoDateString(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00+09:00");
  d.setDate(d.getDate() + days);
  return toTokyoDateString(d);
}

function daysAgo(n, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function buildRecord({ bookId, studentNumber, staffId, lentAt, isReturned, returnedAt = null }) {
  const createdAt = lentAt.toISOString();
  const lentDate = toTokyoDateString(lentAt);
  const dueDate = addDays(lentDate, 14);
  const row = {
    book_id: bookId,
    student_number: studentNumber,
    is_returned: isReturned,
    due_date: dueDate,
    created_at: createdAt,
    lent_by_staff_id: staffId,
  };
  if (isReturned && returnedAt) {
    row.returned_at = returnedAt.toISOString();
    row.returned_by_staff_id = staffId;
  }
  return row;
}

async function main() {
  const [books, students, staff, history] = await Promise.all([
    fetchJson("libraly_app?select=id,title&order=title.asc"),
    fetchJson(
      "libraly_app_student?select=student_number,name,libraly_app_department(name,libraly_app_faculty(name))&order=student_number.asc"
    ),
    fetchJson("libraly_app_staff?select=id,name&limit=1"),
    fetchJson("libraly_app_lending_history?select=book_id,student_number,is_returned"),
  ]);

  if (!books.length || !students.length || !staff.length) {
    throw new Error("マスタ（図書・学生・担当者）が不足しています");
  }

  const staffId = staff[0].id;
  const activeBookIds = new Set(
    history.filter((h) => !h.is_returned).map((h) => h.book_id)
  );
  const freeBooks = books.filter((b) => !activeBookIds.has(b.id));
  let bookIdx = 0;
  const takeBook = () => {
    if (bookIdx >= freeBooks.length) throw new Error("貸出可能な図書が不足しています");
    return freeBooks[bookIdx++].id;
  };

  const maxStudents = students.slice(0, 3);
  const overdueStudents = students.slice(3, 13);
  const otherStudents = students.slice(13);

  const rows = [];

  // 3 学生 × 5 冊（上限いっぱい・貸出中）
  for (const stu of maxStudents) {
    for (let i = 0; i < 5; i++) {
      rows.push(
        buildRecord({
          bookId: takeBook(),
          studentNumber: stu.student_number,
          staffId,
          lentAt: daysAgo(3 + i, 9 + i),
          isReturned: false,
        })
      );
    }
  }

  // 返却予定日超過・未返却 10 件（貸出日は 18〜30 日前）
  for (let i = 0; i < 10; i++) {
    rows.push(
      buildRecord({
        bookId: takeBook(),
        studentNumber: overdueStudents[i].student_number,
        staffId,
        lentAt: daysAgo(18 + i, 11),
        isReturned: false,
      })
    );
  }

  // 返却済み履歴 25 件
  for (let i = 0; i < 25; i++) {
    const stu = otherStudents[i % otherStudents.length];
    const book = books[i % books.length];
    const lentAt = daysAgo(40 + (i % 20), 14);
    const returnedAt = daysAgo(20 + (i % 15), 16);
    rows.push(
      buildRecord({
        bookId: book.id,
        studentNumber: stu.student_number,
        staffId,
        lentAt,
        isReturned: true,
        returnedAt,
      })
    );
  }

  if (rows.length !== 50) throw new Error("件数が 50 ではありません: " + rows.length);

  const batchSize = 25;
  for (let i = 0; i < rows.length; i += batchSize) {
    await insertRows(rows.slice(i, i + batchSize));
  }

  console.log("OK: 50 件投入完了");
  console.log("\n【5冊上限の学生】");
  for (const stu of maxStudents) {
    const dept = stu.libraly_app_department;
    console.log(
      "- " +
        stu.name +
        "（学籍番号 " +
        stu.student_number +
        "） / " +
        dept.libraly_app_faculty.name +
        " / " +
        dept.name
    );
  }
  console.log("\n内訳: 上限5冊×3人=15件, 返却予定日超過未返却=10件, 返却済み=25件");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
