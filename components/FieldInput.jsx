"use client";

// One labeled input for a section's dynamic field, its control chosen
// by the field's own type — shared by EntryCard's edit form and
// AddEntryForm, so a section's fields render identically wherever
// they're edited without any per-field-name code.
export default function FieldInput({ fieldDef, value, onChange }) {
  const inputClass = "rounded border border-zinc-300 px-2 py-1.5";

  if (fieldDef.field_type === "textarea") {
    return (
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        {fieldDef.label}
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={inputClass}
        />
      </label>
    );
  }
  if (fieldDef.field_type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4"
        />
        {fieldDef.label}
      </label>
    );
  }
  if (fieldDef.field_type === "select") {
    const choices = fieldDef.options?.choices || [];
    return (
      <label className="flex flex-col gap-1 text-sm">
        {fieldDef.label}
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">--</option>
          {choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const inputType =
    fieldDef.field_type === "number" || fieldDef.field_type === "count"
      ? "number"
      : fieldDef.field_type === "date"
        ? "date"
        : "text";
  return (
    <label className="flex flex-col gap-1 text-sm">
      {fieldDef.label}
      <input
        type={inputType}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}
