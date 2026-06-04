import { useMemo, useState } from "react";
import MemberPicker from "./MemberPicker";
import Modal from "./Modal";

function createDraft(request) {
  return {
    title: request?.title || "",
    description: request?.description || "",
    studentIds: [],
    teacherIds: [],
  };
}

export default function CreateProjectFromRequestModal({
  open,
  request,
  users,
  isSubmitting,
  onClose,
  onConfirm,
}) {
  const [form, setForm] = useState(createDraft(request));

  const selectedCount = useMemo(
    () => (form.studentIds || []).length + (form.teacherIds || []).length,
    [form.studentIds, form.teacherIds],
  );

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onConfirm({
      title: form.title.trim(),
      description: form.description.trim(),
      startAt: null,
      studentIds: form.studentIds,
      teacherIds: form.teacherIds,
      studentCodes: [],
      teacherCodes: [],
    });
  }

  return (
    <Modal
      open={open}
      title="Створення проєкту із заявки"
      description="Автор заявки стане власником проєкту автоматично. За потреби додайте студентів і менторів одразу перед створенням."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-soft" onClick={onClose} disabled={isSubmitting}>
            Скасувати
          </button>
          <button
            type="submit"
            form="create-project-from-request-form"
            className="button button-primary"
            disabled={isSubmitting || !form.title.trim()}
          >
            {isSubmitting ? "Створення..." : "Створити проєкт"}
          </button>
        </>
      }
    >
      <form id="create-project-from-request-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="detail-grid">
          <div>
            <span>Заявка</span>
            <strong>#{request?.id || "-"}</strong>
          </div>
          <div>
            <span>Автор</span>
            <strong>{request?.authorUserId ? `ID ${request.authorUserId}` : "-"}</strong>
          </div>
          <div>
            <span>Доданих учасників</span>
            <strong>{selectedCount}</strong>
          </div>
        </div>

        <label className="field">
          <span>Назва проєкту</span>
          <input type="text" name="title" value={form.title} onChange={updateField} maxLength={255} required />
        </label>

        <label className="field">
          <span>Опис</span>
          <textarea
            name="description"
            rows={4}
            value={form.description}
            onChange={updateField}
            maxLength={4000}
          />
        </label>

        <div className="member-picker-grid">
          <MemberPicker
            label="Студенти"
            users={users}
            selectedIds={form.studentIds}
            onChange={(studentIds) => setForm((current) => ({ ...current, studentIds }))}
            audience="student"
            placeholder="Пошук студента за іменем, кодом або email"
            helperText="Додайте тих студентів, які працюють у команді разом з автором заявки."
            emptySelectedTitle="Студентів поки не додано"
            emptySelectedDescription="Можна створити проєкт і без додаткових студентів. У такому разі в команді буде лише автор заявки."
            disabled={isSubmitting}
          />

          <MemberPicker
            label="Викладачі / ментори"
            users={users}
            selectedIds={form.teacherIds}
            onChange={(teacherIds) => setForm((current) => ({ ...current, teacherIds }))}
            audience="teacher"
            placeholder="Пошук викладача за іменем, кодом або email"
            helperText="Можна додати викладачів і адміністраторів, які будуть менторами проєкту."
            emptySelectedTitle="Менторів поки не додано"
            emptySelectedDescription="Якщо менторів ще не визначено, їх можна додати пізніше через керування проєктом."
            disabled={isSubmitting}
          />
        </div>
      </form>
    </Modal>
  );
}
