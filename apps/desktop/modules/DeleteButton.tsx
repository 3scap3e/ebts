import { useEffect, useState } from "react";
import { ghostButtonClass } from "@/hooks/theme";
import { dangerButtonClass, smallButtonClass, smallDangerButtonClass } from "@/hooks/classes";
import type { DeleteButtonProps } from "@/types/ui";

export default function DeleteButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Confirm",
  compact = false,
  disabled = false,
}: DeleteButtonProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const idle = compact ? smallButtonClass : ghostButtonClass;
  const hot = compact ? smallDangerButtonClass : dangerButtonClass;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      className={armed ? hot : idle}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
