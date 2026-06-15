/**
 * 学生セルフ貸出 — 認証（Supabase Auth + 学生マスタ照合）
 */
(function (global) {
  const STUDENT_TABLE = "libraly_app_student";
  const STUDENT_EMAIL_DOMAIN = "@libraly.student";
  const ROLE_STUDENT = "student";

  function studentAuthEmail(studentNumber) {
    return String(studentNumber).trim().toLowerCase() + STUDENT_EMAIL_DOMAIN;
  }

  function isStudentSession(session) {
    if (!session || !session.user) return false;
    const meta = session.user.user_metadata || {};
    return meta.role === ROLE_STUDENT;
  }

  function normalizeBirthDateInput(value) {
    const v = String(value || "").trim().replace(/\D/g, "");
    return /^\d{8}$/.test(v) ? v : "";
  }

  async function findStudentForRegistration(studentNumber, birthDate) {
    const sn = String(studentNumber).trim();
    const bd = normalizeBirthDateInput(birthDate);
    if (!sn || !bd) {
      return { student: null, error: { message: "学籍番号と生年月日を入力してください。" } };
    }

    const { data, error } = await LibralyAuth.getClient()
      .from(STUDENT_TABLE)
      .select("id, student_number, name, birth_date, auth_user_id")
      .eq("student_number", sn)
      .maybeSingle();

    if (error) {
      console.error(error);
      return { student: null, error: { message: "学生マスタの確認に失敗しました。" } };
    }
    if (!data) {
      return {
        student: null,
        error: { message: "学籍番号が学生マスタに登録されていません。" },
      };
    }
    if (data.birth_date !== bd) {
      return { student: null, error: { message: "生年月日が一致しません。" } };
    }
    if (data.auth_user_id) {
      return {
        student: null,
        error: { message: "この学籍番号は既にアカウント登録済みです。ログインしてください。" },
      };
    }
    return { student: data, error: null };
  }

  async function linkStudentAuthUser(studentId, authUserId) {
    const { error } = await LibralyAuth.getClient()
      .from(STUDENT_TABLE)
      .update({ auth_user_id: authUserId })
      .eq("id", studentId)
      .is("auth_user_id", null);

    if (error) {
      console.error(error);
      return { error };
    }
    return { error: null };
  }

  async function signUpStudent({ student_number, birth_date, password }) {
    const check = await findStudentForRegistration(student_number, birth_date);
    if (check.error) return { error: check.error };
    const student = check.student;
    const email = studentAuthEmail(student.student_number);

    const { data, error } = await LibralyAuth.getClient().auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          role: ROLE_STUDENT,
          student_number: student.student_number,
          name: student.name,
        },
      },
    });

    if (error) return { error: error };

    if (data.user) {
      const link = await linkStudentAuthUser(student.id, data.user.id);
      if (link.error) {
        return {
          error: {
            message:
              "アカウントは作成されましたが学生マスタへの紐づけに失敗しました。職員に連絡してください。",
          },
        };
      }
    }

    return { data: data, error: null, student: student };
  }

  async function signInStudent({ student_number, password }) {
    const email = studentAuthEmail(student_number);
    return LibralyAuth.getClient().auth.signInWithPassword({
      email: email,
      password: password,
    });
  }

  async function resolveStudentFromSession(session) {
    if (!isStudentSession(session)) return null;

    const meta = session.user.user_metadata || {};
    const studentNumber = meta.student_number;

    if (session.user.id) {
      const { data: byAuth, error: errAuth } = await LibralyAuth.getClient()
        .from(STUDENT_TABLE)
        .select(
          "id, student_number, name, birth_date, auth_user_id, department_id, " +
            "libraly_app_department ( name, libraly_app_faculty ( name ) )"
        )
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (errAuth) {
        console.error(errAuth);
      } else if (byAuth) {
        return byAuth;
      }
    }

    if (!studentNumber) return null;

    const { data, error } = await LibralyAuth.getClient()
      .from(STUDENT_TABLE)
      .select(
        "id, student_number, name, birth_date, auth_user_id, department_id, " +
          "libraly_app_department ( name, libraly_app_faculty ( name ) )"
      )
      .eq("student_number", studentNumber)
      .maybeSingle();

    if (error) {
      console.error(error);
      return null;
    }
    return data || null;
  }

  async function getCurrentStudent() {
    const session = await LibralyAuth.getSession();
    if (!session) return null;
    return resolveStudentFromSession(session);
  }

  async function requireStudentSession() {
    const session = await LibralyAuth.getSession();
    if (!session || !isStudentSession(session)) {
      global.location.replace("student-borrow.html");
      return null;
    }
    const student = await resolveStudentFromSession(session);
    if (!student) {
      await LibralyAuth.getClient().auth.signOut();
      global.location.replace("student-borrow.html");
      return null;
    }
    return { session: session, student: student };
  }

  async function studentSignOut() {
    await LibralyAuth.getClient().auth.signOut();
    global.location.replace("student-borrow.html");
  }

  global.LibralyStudentAuth = {
    ROLE_STUDENT: ROLE_STUDENT,
    studentAuthEmail: studentAuthEmail,
    isStudentSession: isStudentSession,
    normalizeBirthDateInput: normalizeBirthDateInput,
    signUpStudent: signUpStudent,
    signInStudent: signInStudent,
    getCurrentStudent: getCurrentStudent,
    requireStudentSession: requireStudentSession,
    studentSignOut: studentSignOut,
    resolveStudentFromSession: resolveStudentFromSession,
  };
})(window);
