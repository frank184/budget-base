import React from "react";

const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "JPY", "AUD"];

function IconWrap({ children }) {
  return <span className="toolbar-icon" aria-hidden="true">{children}</span>;
}

function CurrencyIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v10" />
        <path d="M9.5 9.5c.5-1 4.5-1 5 0s-.5 2-2.5 2-3 1-2.5 2 4.5 1 5 0" />
      </svg>
    </IconWrap>
  );
}

function ThemeIcon({ theme }) {
  return (
    <IconWrap>
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 15.5A8.5 8.5 0 1 1 8.5 4a6.8 6.8 0 0 0 11.5 11.5Z" />
        </svg>
      )}
    </IconWrap>
  );
}

function ExportIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v11" />
        <path d="m8 10 4 4 4-4" />
        <path d="M5 19h14" />
      </svg>
    </IconWrap>
  );
}

function ImportIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21V10" />
        <path d="m8 14 4-4 4 4" />
        <path d="M5 5h14" />
      </svg>
    </IconWrap>
  );
}

function ResetIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
        <path d="M4.5 5.5v5h5" />
        <circle cx="12" cy="12" r="2.2" />
      </svg>
    </IconWrap>
  );
}

function LogoutIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    </IconWrap>
  );
}

function ToolbarButton({ label, onClick, icon, title }) {
  return (
    <label className="toolbar-field toolbar-action">
      <span className="toolbar-label">{label}</span>
      <button className="ghost-button toolbar-button toolbar-icon-button" onClick={onClick} title={title} aria-label={title}>
        {icon}
      </button>
    </label>
  );
}

export function TopBar({
  user,
  theme,
  currency,
  showCurrencyCode,
  onThemeToggle,
  onCurrencyChange,
  onCurrencyCodeToggle,
  onExport,
  onImport,
  onReset,
  onLogout
}) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Quiet monthly budgeting</p>
        <h1>Budget Base</h1>
        <p className="hero-copy">
          Plan the month, adjust when life shifts, and keep the numbers close.
        </p>
        {user && (
          <p className="hero-copy auth-identity">
            Signed in as <strong>{user.displayName}</strong> <span>{user.email}</span>
          </p>
        )}
      </div>
      <div className="hero-actions">
        <label className="toolbar-field">
          <span className="toolbar-label">Currency</span>
          <div
            className="toolbar-select-wrap"
            onDoubleClick={onCurrencyCodeToggle}
            title={`Currency: ${currency}. Double-click to turn currency codes ${showCurrencyCode ? "off" : "on"}.`}
          >
            <CurrencyIcon />
            <select
              value={currency}
              onChange={(event) => onCurrencyChange(event.target.value)}
              title={`Currency: ${currency}. Double-click to turn currency codes ${showCurrencyCode ? "off" : "on"}.`}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </label>
        <ToolbarButton
          label="Theme"
          onClick={onThemeToggle}
          icon={<ThemeIcon theme={theme} />}
          title={theme === "dark" ? "Light Mode" : "Dark Mode"}
        />
        <ToolbarButton label="Export" onClick={onExport} icon={<ExportIcon />} title="Export" />
        <label className="toolbar-field toolbar-action">
          <span className="toolbar-label">Import</span>
          <span className="ghost-button file-button toolbar-button toolbar-icon-button" title="Import" aria-label="Import">
            <ImportIcon />
            <input type="file" accept="application/json" onChange={onImport} />
          </span>
        </label>
        <ToolbarButton label="Reset" onClick={onReset} icon={<ResetIcon />} title="Reset" />
        <ToolbarButton label="Logout" onClick={onLogout} icon={<LogoutIcon />} title="Logout" />
      </div>
    </header>
  );
}
