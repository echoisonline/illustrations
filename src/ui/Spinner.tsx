/**
 * Индикатор ожидания. Вариант bars: три полосы с разными фазами.
 * Геометрию анимируем в CSS, поэтому цвет наследуется от текста.
 */
type SpinnerProps = {
  size?: number;
  className?: string;
};

export function Spinner({ size = 26, className }: SpinnerProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="status"
      aria-label="подбираем композицию"
    >
      <rect className="spinnerBar" x="1" y="1" width="6" height="22" fill="currentColor" />
      <rect className="spinnerBar spinnerBar2" x="9" y="1" width="6" height="22" fill="currentColor" />
      <rect className="spinnerBar spinnerBar3" x="17" y="1" width="6" height="22" fill="currentColor" />
    </svg>
  );
}
