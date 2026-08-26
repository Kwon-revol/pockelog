import type { InputHTMLAttributes } from "react";

type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: string;
  errors?: string[];
};

export function FormField({ label, errors, id, name, ...inputProps }: FormFieldProps) {
  const fieldId = id ?? name;
  const errorId = errors?.length ? `${fieldId}-error` : undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </label>
      <input
        {...inputProps}
        id={fieldId}
        name={name}
        aria-describedby={errorId}
        aria-invalid={Boolean(errors?.length)}
        className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 aria-invalid:border-rose-400 aria-invalid:ring-rose-400/10"
      />
      {errors?.length ? (
        <ul id={errorId} className="mt-2 space-y-1 text-sm text-rose-600">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
