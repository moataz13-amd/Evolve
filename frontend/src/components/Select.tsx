import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

type Choice = { value: string; label: string; disabled: boolean; group?: string };
function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child) ? text(child.props.children) : String(child),
    )
    .join('');
}
function choices(children: ReactNode, group?: string, disabled = false): Choice[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        value?: string | number;
        label?: string;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === 'option')
      return [
        {
          value: String(child.props.value ?? text(child.props.children)),
          label: child.props.label || text(child.props.children),
          disabled: disabled || !!child.props.disabled,
          group,
        },
      ];
    return choices(
      child.props.children,
      child.type === 'optgroup' ? child.props.label : group,
      disabled || !!child.props.disabled,
    );
  });
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select(props, forwardedRef) {
    const {
      children,
      className = '',
      value,
      defaultValue,
      onChange,
      onBlur,
      ...nativeProps
    } = props;
    const generatedId = useId();
    const id = props.id || generatedId;
    const listId = `${id}-options`;
    const native = useRef<HTMLSelectElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState(String(defaultValue ?? ''));
    const [accessibleLabel, setAccessibleLabel] = useState('');
    const [active, setActive] = useState(0);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 300 });
    const typed = useRef({ text: '', time: 0 });
    const items = choices(children);
    const selectedValue = value == null ? current : String(value);
    const selected = items.find((item) => item.value === selectedValue) || items[0];
    const enabled = items
      .map((item, index) => (item.disabled ? -1 : index))
      .filter((index) => index >= 0);
    useLayoutEffect(() => {
      if (value == null && native.current) setCurrent(native.current.value);
      const label =
        trigger.current?.closest('label') ||
        document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label) {
        const copy = label.cloneNode(true) as HTMLElement;
        copy
          .querySelectorAll('.evolve-select, select, button')
          .forEach((element) => element.remove());
        setAccessibleLabel(copy.textContent?.trim() || '');
      }
    }, [value, children, id]);

    function show() {
      if (!trigger.current || trigger.current.disabled || !enabled.length) return;
      const rect = trigger.current.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const below = viewportHeight - rect.bottom - 12;
      const height = Math.min(300, items.length * 42 + 16);
      const above = below < Math.min(height, 180) && rect.top > below;
      setPosition({
        top: above ? rect.top - Math.min(height, rect.top - 12) - 6 : rect.bottom + 6,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: rect.width,
        maxHeight: Math.max(80, above ? Math.min(300, rect.top - 18) : Math.min(300, below)),
      });
      const index = items.findIndex((item) => item.value === selected?.value && !item.disabled);
      setActive(index >= 0 ? index : enabled[0]);
      setOpen(true);
    }
    function choose(index: number) {
      const item = items[index];
      if (!item || item.disabled || !native.current) return;
      native.current.value = item.value;
      native.current.dispatchEvent(new Event('change', { bubbles: true }));
      setCurrent(item.value);
      setOpen(false);
      trigger.current?.focus();
    }
    useEffect(() => {
      if (!open) return;
      const dismiss = (event: Event) => {
        const target = event.target as Node | null;
        if (target && (menu.current?.contains(target) || trigger.current?.contains(target))) return;
        setOpen(false);
      };
      const resize = () => setOpen(false);
      document.addEventListener('pointerdown', dismiss, true);
      window.addEventListener('scroll', dismiss, true);
      window.addEventListener('resize', resize);
      return () => {
        document.removeEventListener('pointerdown', dismiss, true);
        window.removeEventListener('scroll', dismiss, true);
        window.removeEventListener('resize', resize);
      };
    }, [open]);
    useEffect(() => {
      if (open)
        menu.current
          ?.querySelector(`#${CSS.escape(listId)}-${active}`)
          ?.scrollIntoView({ block: 'nearest' });
    }, [open, active, listId]);
    useLayoutEffect(() => {
      if (!open || !trigger.current || !menu.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const height = menu.current.getBoundingClientRect().height;
      const below = (window.visualViewport?.height ?? window.innerHeight) - rect.bottom - 12;
      const above = below < Math.min(height, 180) && rect.top > below;
      const top = above ? Math.max(8, rect.top - height - 6) : rect.bottom + 6;
      setPosition((current) => (Math.abs(current.top - top) > 1 ? { ...current, top } : current));
    }, [open]);

    // Native list selects retain their multi-selection and form behavior.
    if (props.multiple || (props.size && props.size > 1))
      return (
        <select {...props} ref={forwardedRef}>
          {children}
        </select>
      );
    const portalTarget = trigger.current?.closest('dialog') || document.body;
    return (
      <span className={`evolve-select ${className}`}>
        <select
          {...nativeProps}
          id={`${id}-native`}
          value={value}
          defaultValue={defaultValue}
          ref={(node) => {
            native.current = node;
            if (typeof forwardedRef === 'function') forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          tabIndex={-1}
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            minHeight: 0,
            padding: 0,
            border: 0,
            overflow: 'hidden',
            clipPath: 'inset(50%)',
          }}
          onChange={(event) => {
            setCurrent(event.target.value);
            onChange?.(event);
          }}
          onBlur={onBlur}
          onInvalid={(event) => {
            event.preventDefault();
            trigger.current?.focus();
            props.onInvalid?.(event);
          }}
        >
          {children}
        </select>
        <button
          ref={trigger}
          id={id}
          type="button"
          role="combobox"
          className="evolve-select-trigger"
          disabled={props.disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          aria-label={props['aria-label'] || accessibleLabel || selected?.label}
          aria-labelledby={props['aria-labelledby']}
          aria-invalid={props['aria-invalid']}
          aria-required={props.required}
          aria-describedby={props['aria-describedby']}
          onClick={() => (open ? setOpen(false) : show())}
          onBlur={(event) => {
            setOpen(false);
            native.current?.dispatchEvent(
              new FocusEvent('focusout', { bubbles: true, relatedTarget: event.relatedTarget }),
            );
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              if (open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }
              return;
            }
            if (event.key === 'Tab') {
              setOpen(false);
              return;
            }
            if (['Enter', ' '].includes(event.key)) {
              event.preventDefault();
              if (open) choose(active);
              else show();
              return;
            }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              if (!open) {
                show();
                return;
              }
              const index = enabled.indexOf(active);
              setActive(
                event.key === 'Home'
                  ? enabled[0]
                  : event.key === 'End'
                    ? enabled.at(-1)!
                    : enabled[
                        Math.max(
                          0,
                          Math.min(
                            enabled.length - 1,
                            index + (event.key === 'ArrowDown' ? 1 : -1),
                          ),
                        )
                      ],
              );
              return;
            }
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              event.preventDefault();
              const now = Date.now();
              const search =
                (now - typed.current.time > 600 ? '' : typed.current.text) +
                event.key.toLowerCase();
              typed.current = { text: search, time: now };
              const index = items.findIndex(
                (item) => !item.disabled && item.label.toLowerCase().startsWith(search),
              );
              if (index >= 0) {
                if (open) setActive(index);
                else choose(index);
              }
            }
          }}
        >
          <span>{selected?.label || 'Select an option'}</span>
          <ChevronDown size={17} aria-hidden="true" />
        </button>
        {open &&
          createPortal(
            <div
              ref={menu}
              id={listId}
              role="listbox"
              className="evolve-select-menu"
              dir={trigger.current ? getComputedStyle(trigger.current).direction : undefined}
              aria-label={props['aria-label'] || accessibleLabel || 'Options'}
              style={position}
            >
              {items.map((item, index) => (
                <div key={`${index}:${item.value}`}>
                  {item.group && item.group !== items[index - 1]?.group && (
                    <div className="evolve-select-group">{item.group}</div>
                  )}
                  <div
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={item.value === selected?.value}
                    aria-disabled={item.disabled || undefined}
                    className={`evolve-select-option ${index === active ? 'is-active' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerMove={(event) => {
                      if (event.pointerType === 'mouse' && !item.disabled) setActive(index);
                    }}
                    onClick={() => choose(index)}
                  >
                    <span>{item.label}</span>
                    {item.value === selected?.value && <Check size={16} aria-hidden="true" />}
                  </div>
                </div>
              ))}
            </div>,
            portalTarget,
          )}
      </span>
    );
  },
);
