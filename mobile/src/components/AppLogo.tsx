type AppLogoProps = {
  className?: string;
  alt?: string;
};

export function AppLogo({
  className = "",
  alt = "Capture Calcine logo",
}: AppLogoProps) {
  const combinedClassName = ["app-logo", className].filter(Boolean).join(" ");

  return <img className={combinedClassName} src="/app-logo.png" alt={alt} />;
}
