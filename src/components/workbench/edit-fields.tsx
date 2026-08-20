export function TextField({
  label,
  value,
  onChange,
  multiline = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      {multiline ? (
        <textarea
          className="mt-1 min-h-24 w-full rounded-md border border-line px-3 py-2 text-sm"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <input
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      )}
    </label>
  );
}

export function ListField({
  label,
  values,
  onChange
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <textarea
        className="mt-1 min-h-24 w-full rounded-md border border-line px-3 py-2 text-sm"
        onChange={(event) => onChange(splitLines(event.target.value))}
        value={values.join("\n")}
      />
    </label>
  );
}

export function Info({ label, value }: { label: string; value?: string | string[] }) {
  const display = Array.isArray(value) ? value.join(" / ") : value;
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 rounded-md bg-paper px-3 py-2 text-sm whitespace-pre-wrap">{display || "未记录"}</div>
    </div>
  );
}

export function SectionActions({
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete
}: {
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {editing ? (
        <>
          <button className="rounded-md bg-action px-3 py-2 text-sm font-medium text-white" onClick={onSave} type="button">
            保存
          </button>
          <button className="rounded-md border border-line px-3 py-2 text-sm" onClick={onCancel} type="button">
            取消
          </button>
        </>
      ) : (
        <button className="rounded-md border border-line px-3 py-2 text-sm" onClick={onEdit} type="button">
          编辑
        </button>
      )}
      <button className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-600" onClick={onDelete} type="button">
        删除
      </button>
    </div>
  );
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}
