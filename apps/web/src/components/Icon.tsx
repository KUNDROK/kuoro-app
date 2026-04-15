import type { ReactNode, SVGProps } from "react";

type IconName =
  | "alert"
  | "assistant"
  | "building"
  | "calendar"
  | "chart"
  | "check"
  | "chevron"
  | "clipboard"
  | "dashboard"
  | "document"
  | "home"
  | "mail"
  | "moon"
  | "logout"
  | "percent"
  | "settings"
  | "shield"
  | "sun"
  | "users";

type Props = SVGProps<SVGSVGElement> & {
  name: IconName;
};

const paths: Record<IconName, ReactNode> = {
  alert: (
    <>
      <path d="M12 4.75 3.75 19.25h16.5L12 4.75Z" />
      <path d="M12 9.5v4.25" />
      <path d="M12 16.75h.01" />
    </>
  ),
  assistant: (
    <>
      <path d="M12 4.75v2" />
      <path d="M6.75 8.25h10.5c.83 0 1.5.67 1.5 1.5v6.5c0 .83-.67 1.5-1.5 1.5H6.75c-.83 0-1.5-.67-1.5-1.5v-6.5c0-.83.67-1.5 1.5-1.5Z" />
      <path d="M8.75 12.25h.01" />
      <path d="M15.25 12.25h.01" />
      <path d="M9.5 15.25h5" />
      <path d="M4.75 12.25H3.5" />
      <path d="M20.5 12.25h-1.25" />
    </>
  ),
  building: (
    <>
      <path d="M5.25 20.25V4.75h10.5v15.5" />
      <path d="M8.25 8.25h.01" />
      <path d="M12 8.25h.01" />
      <path d="M8.25 12h.01" />
      <path d="M12 12h.01" />
      <path d="M8.25 15.75h.01" />
      <path d="M15.75 10.25h3v10" />
      <path d="M3.75 20.25h16.5" />
    </>
  ),
  calendar: (
    <>
      <path d="M6.75 3.75v3" />
      <path d="M17.25 3.75v3" />
      <path d="M4.75 8.25h14.5" />
      <path d="M5.75 5.75h12.5c.55 0 1 .45 1 1v12.5c0 .55-.45 1-1 1H5.75c-.55 0-1-.45-1-1V6.75c0-.55.45-1 1-1Z" />
      <path d="M8.25 12.25h.01" />
      <path d="M12 12.25h.01" />
      <path d="M15.75 12.25h.01" />
      <path d="M8.25 16h.01" />
      <path d="M12 16h.01" />
    </>
  ),
  chart: (
    <>
      <path d="M4.75 19.25h14.5" />
      <path d="M7.25 16.25v-5" />
      <path d="M12 16.25v-8.5" />
      <path d="M16.75 16.25v-3" />
      <path d="M5.25 6.75l4 2.75 3.5-4 5.75 4" />
    </>
  ),
  check: (
    <>
      <path d="M20 6.75 9.5 17.25 4 11.75" />
    </>
  ),
  chevron: (
    <>
      <path d="m9.25 6.75 5.5 5.25-5.5 5.25" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 4.75h6l.75 2h1.5c.55 0 1 .45 1 1v11.5c0 .55-.45 1-1 1H6.75c-.55 0-1-.45-1-1V7.75c0-.55.45-1 1-1h1.5l.75-2Z" />
      <path d="M9 6.75h6" />
      <path d="M8.75 11.25h6.5" />
      <path d="M8.75 15h4.5" />
    </>
  ),
  dashboard: (
    <>
      <path d="M4.75 12.75a7.25 7.25 0 1 1 14.5 0v4.5c0 .55-.45 1-1 1H5.75c-.55 0-1-.45-1-1v-4.5Z" />
      <path d="m12 12.75 3.25-3.25" />
      <path d="M7.75 14.25h.01" />
      <path d="M16.25 14.25h.01" />
      <path d="M12 7.75h.01" />
    </>
  ),
  document: (
    <>
      <path d="M7.25 3.75h6l3.5 3.5v13H7.25c-.55 0-1-.45-1-1V4.75c0-.55.45-1 1-1Z" />
      <path d="M13.25 3.75v4h4" />
      <path d="M9.25 12h5.5" />
      <path d="M9.25 15.75h5.5" />
    </>
  ),
  home: (
    <>
      <path d="M4.75 10.75 12 4.75l7.25 6" />
      <path d="M6.75 9.5v9.75h10.5V9.5" />
      <path d="M10 19.25V14h4v5.25" />
    </>
  ),
  mail: (
    <>
      <path d="M5.75 6.25h12.5c.55 0 1 .45 1 1v9.5c0 .55-.45 1-1 1H5.75c-.55 0-1-.45-1-1v-9.5c0-.55.45-1 1-1Z" />
      <path d="m5.25 7.25 6.75 5 6.75-5" />
    </>
  ),
  moon: (
    <>
      <path d="M18.75 15.25a7.25 7.25 0 0 1-10-10 7.75 7.75 0 1 0 10 10Z" />
    </>
  ),
  logout: (
    <>
      <path d="M9.25 5.25h-2.5c-.55 0-1 .45-1 1v11.5c0 .55.45 1 1 1h2.5" />
      <path d="M13.25 8.25 17 12l-3.75 3.75" />
      <path d="M17 12H9.25" />
    </>
  ),
  percent: (
    <>
      <path d="m6.75 17.25 10.5-10.5" />
      <path d="M8 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      <path d="M16 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </>
  ),
  settings: (
    <>
      <path d="M12 14.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" />
      <path d="m17.75 13.25 1.25 1-.9 1.55-1.55-.6a6.4 6.4 0 0 1-1.35.8l-.25 1.65h-1.8L12.9 16a6.8 6.8 0 0 1-1.8 0l-.25 1.65h-1.8L8.8 16a6.4 6.4 0 0 1-1.35-.8l-1.55.6L5 14.25l1.25-1a6 6 0 0 1 0-2.5L5 9.75l.9-1.55 1.55.6c.42-.32.87-.58 1.35-.8l.25-1.65h1.8L11.1 8a6.8 6.8 0 0 1 1.8 0l.25-1.65h1.8L15.2 8c.48.22.93.48 1.35.8l1.55-.6.9 1.55-1.25 1a6 6 0 0 1 0 2.5Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.75 18.25 6v4.75c0 4.2-2.52 7.95-6.25 9.5-3.73-1.55-6.25-5.3-6.25-9.5V6L12 3.75Z" />
      <path d="m9.5 12 1.75 1.75 3.5-4" />
    </>
  ),
  sun: (
    <>
      <path d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
      <path d="M12 3.75v1.5" />
      <path d="M12 18.75v1.5" />
      <path d="m5.75 5.75 1.05 1.05" />
      <path d="m17.2 17.2 1.05 1.05" />
      <path d="M3.75 12h1.5" />
      <path d="M18.75 12h1.5" />
      <path d="m5.75 18.25 1.05-1.05" />
      <path d="m17.2 6.8 1.05-1.05" />
    </>
  ),
  users: (
    <>
      <path d="M9.75 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M4.75 19.25c.4-3.05 2.28-5 5-5s4.6 1.95 5 5" />
      <path d="M15.5 11.25a2.5 2.5 0 0 0 .25-4.98" />
      <path d="M16.75 14.5c1.35.72 2.2 2.05 2.5 3.75" />
    </>
  )
};

export function Icon({ name, ...props }: Props) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75">
        {paths[name]}
      </g>
    </svg>
  );
}
