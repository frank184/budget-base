const THEME_BACKGROUNDS = {
  dark: "#111513",
  light: "#f4f7f1"
};

export function syncDocumentTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  const backgroundColor = THEME_BACKGROUNDS[normalizedTheme];

  document.documentElement.dataset.theme = normalizedTheme;
  document.documentElement.style.backgroundColor = backgroundColor;

  if (document.body) {
    document.body.style.backgroundColor = backgroundColor;
  }

  const favicon = document.getElementById("app-favicon");
  if (favicon) {
    favicon.setAttribute(
      "href",
      normalizedTheme === "dark" ? "/favicon-dark.svg" : "/favicon-light.svg"
    );
  }
}
