"use client";

import { useState } from "react";
import type { FieldDef } from "@/lib/types";
import styles from "./FieldInput.module.css";

export interface FieldInputProps {
  fieldDef: FieldDef;
  value: unknown;
  onChange: (value: string | boolean) => void;
  /** The trip's real (date-range) or estimated length in nights — see
   * lib/fieldTypes/price.ts's computeTripNights. Only used by a
   * "price"-type field's own "total for stay" mode, to bake a real
   * "for N nights" into what actually gets stored the moment it's
   * entered, rather than leaving that to be guessed later from
   * whatever the trip's length happens to be by then. */
  tripNights?: number | null;
  disabled?: boolean;
}

type PriceMode = "perNight" | "total";

function priceModeFor(raw: string): PriceMode {
  return /\/\s?night|per\s?night/i.test(raw) ? "perNight" : "total";
}

function amountFrom(raw: string): string {
  const m = raw.match(/[\d,]+(?:\.\d+)?/);
  return m ? m[0] : "";
}

// A price used to be just a plain text field — free-form enough that a
// bare number ("273") had no way to say whether it meant per night or
// a total for the whole stay, and guessing from the trip's own length
// actively produced a wrong reading the moment that guess was wrong
// (confirmed live: a real $273/night price, with the trip's real
// 7-night length known, got divided down to "~$30/night"). This asks
// directly instead: an amount plus an explicit per-night/total-for-
// stay choice, composed into one self-describing stored string
// ("$273/night", or "$1,911 for 7 nights" when the trip's length is
// known) — unambiguous from then on, no runtime guessing involved (see
// lib/fieldTypes/price.ts's hasStatedRate/extractAvgPerNight).
function PriceFieldInput({ fieldDef, value, onChange, tripNights, disabled }: FieldInputProps) {
  const raw = (value as string) || "";
  const [amount, setAmount] = useState(() => amountFrom(raw));
  const [mode, setMode] = useState<PriceMode>(() => priceModeFor(raw));

  function commit(nextAmount: string, nextMode: PriceMode) {
    if (!nextAmount.trim()) {
      onChange("");
      return;
    }
    const num = Number(nextAmount.replace(/,/g, ""));
    if (Number.isNaN(num)) return;
    const formatted = `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (nextMode === "perNight") {
      onChange(`${formatted}/night`);
    } else if (tripNights) {
      onChange(`${formatted} for ${tripNights} night${tripNights === 1 ? "" : "s"}`);
    } else {
      onChange(formatted);
    }
  }

  return (
    <label className={styles["field"]}>
      {fieldDef.label}
      <div className={styles["price-row"]}>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            commit(e.target.value, mode);
          }}
          placeholder="e.g. 273"
          className={styles["input"]}
          disabled={disabled}
        />
        <select
          value={mode}
          onChange={(e) => {
            const nextMode = e.target.value as PriceMode;
            setMode(nextMode);
            commit(amount, nextMode);
          }}
          className={styles["input"]}
          disabled={disabled}
        >
          <option value="perNight">per night</option>
          <option value="total">total for stay</option>
        </select>
      </div>
      {mode === "total" && !tripNights && (
        <span className={styles["price-hint"]}>
          No trip length set yet (Trip Settings) — this will show as a plain total until it computes an avg/night.
        </span>
      )}
    </label>
  );
}

// One labeled input for a section's dynamic field, its control chosen
// by the field's own type — shared by EntryCard's edit form and
// AddEntryForm, so a section's fields render identically wherever
// they're edited without any per-field-name code.
export default function FieldInput({ fieldDef, value, onChange, tripNights, disabled }: FieldInputProps) {
  if (fieldDef.field_type === "price") {
    return <PriceFieldInput fieldDef={fieldDef} value={value} onChange={onChange} tripNights={tripNights} disabled={disabled} />;
  }
  if (fieldDef.field_type === "textarea") {
    return (
      <label className={styles["wide"]}>
        {fieldDef.label}
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={styles["input"]}
          disabled={disabled}
        />
      </label>
    );
  }
  if (fieldDef.field_type === "boolean") {
    return (
      <label className={styles["checkbox-field"]}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className={styles["checkbox"]}
          disabled={disabled}
        />
        {fieldDef.label}
      </label>
    );
  }
  if (fieldDef.field_type === "select") {
    const choices = fieldDef.options?.choices || [];
    return (
      <label className={styles["field"]}>
        {fieldDef.label}
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={styles["input"]}
          disabled={disabled}
        >
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
    <label className={styles["field"]}>
      {fieldDef.label}
      <input
        type={inputType}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={styles["input"]}
        disabled={disabled}
      />
    </label>
  );
}
