import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export function Dropdown({ children, value, onChange, disabled, ...props }: any) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const options = Children.toArray(children).filter(isValidElement).map((element: any) => ({
    value: String(element.props.value ?? element.props.children),
    label: element.props.children,
    disabled: element.props.disabled,
  }));
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const toggle = () => {
    setAbove((root.current?.getBoundingClientRect().bottom ?? 0) > innerHeight - 220);
    setOpen(!open);
  };
  return <div ref={root} className="dropdown" onKeyDown={(event) => {
    if (event.key === "Escape") { event.stopPropagation(); setOpen(false); root.current?.querySelector<HTMLButtonElement>("[role=combobox]")?.focus(); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) { toggle(); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>("[role=option]:not(:disabled)")?.focus()); return; }
      const items = [...(root.current?.querySelectorAll<HTMLButtonElement>("[role=option]:not(:disabled)") ?? [])];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
      items[index]?.focus();
    }
    if (event.key === "Tab") setOpen(false);
  }}>
    <button type="button" role="combobox" aria-label={props["aria-label"]} aria-expanded={open} aria-controls={id} aria-haspopup="listbox" className="dropdown-trigger" disabled={disabled} onClick={toggle}>
      <span>{options.find((option) => option.value === String(value))?.label ?? "Choose"}</span><ChevronDown size={15} />
    </button>
    {open && <div id={id} role="listbox" aria-label={props["aria-label"]} className={`dropdown-menu${above ? " above" : ""}`}>
      {options.map((option) => <button type="button" role="option" aria-selected={option.value === String(value)} disabled={option.disabled} key={option.value} onClick={() => {
        onChange?.({ target: { value: option.value }, currentTarget: { value: option.value } }); setOpen(false); root.current?.querySelector<HTMLButtonElement>("[role=combobox]")?.focus();
      }}><span>{option.label}</span>{option.value === String(value) && <Check size={14} />}</button>)}
    </div>}
  </div>;
}

const colors = ["#8b5cf6", "#3b82f6", "#06b6d4", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899", "#64748b", "#292637"];
export function ColorPicker({ label, value, onChange, onInput, disabled }: any) {
  const [advanced, setAdvanced] = useState(false);
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const update = (color: string) => {
    const event = { target: { value: color }, currentTarget: { value: color } };
    (onChange ?? onInput)?.(event);
  };
  return <div className="field color-picker"><span>{label}</span>
    <div className="color-swatches">{colors.map((color) => <button type="button" disabled={disabled} key={color} aria-label={`${label}: ${color}`} aria-pressed={value.toLowerCase() === color} style={{ background: color }} onClick={() => update(color)}>{value.toLowerCase() === color && <Check size={12} />}</button>)}</div>
    <button className="text-button advanced-color" type="button" disabled={disabled} aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>Advanced color</button>
    {advanced && <div className="advanced-color-fields"><input type="color" aria-label={`${label} color picker`} disabled={disabled} value={value} onChange={(event) => update(event.target.value)} /><input aria-label={`${label} HEX`} disabled={disabled} value={hex} maxLength={7} onChange={(event) => { setHex(event.target.value); if (/^#[\da-f]{6}$/i.test(event.target.value)) update(event.target.value); }} onBlur={() => setHex(value)} /></div>}
  </div>;
}
