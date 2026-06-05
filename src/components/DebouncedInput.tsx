import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  delay?: number;
  className?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  title?: string;
}

export function DebouncedInput({
  value,
  onChange,
  delay = 500,
  className,
  placeholder,
  type = "text",
  disabled,
  title,
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync from parent when value changes externally (e.g. settings load)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setLocalValue(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(next), delay);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <Input
      type={type}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      title={title}
      value={localValue}
      onChange={handleChange}
      onBlur={() => {
        clearTimeout(timerRef.current);
        if (localValue !== value) onChange(localValue);
      }}
    />
  );
}
