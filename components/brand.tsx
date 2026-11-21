type BrandLogoProps = {
  small?: boolean;
  label?: string;
};

export function BrandLogo({ small = false, label = "הוצאות הבית" }: BrandLogoProps) {
  return (
    <span className={`brand-mark ${small ? "small-mark" : ""}`} role="img" aria-label={label}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M10 22.5 24 11l14 11.5v13a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3v-13Z" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinejoin="round" />
        <path d="M18 38.5V28h12v10.5M15 22h18" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="35.5" cy="13" r="6.5" fill="var(--primary)" stroke="currentColor" strokeWidth="2.3" />
        <path d="M35.5 9.8v6.4M32.8 13h5.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function HouseholdIllustration() {
  return (
    <svg className="welcome-illustration" viewBox="0 0 320 180" aria-hidden="true">
      <path d="M42 142h236" stroke="currentColor" strokeOpacity=".18" strokeWidth="2" strokeLinecap="round" />
      <path d="m72 105 45-39 45 39v37H72v-37Z" fill="currentColor" fillOpacity=".07" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
      <path d="m62 105 55-48 55 48M105 142v-29h24v29" fill="none" stroke="currentColor" strokeOpacity=".52" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="178" y="66" width="62" height="76" rx="10" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeOpacity=".28" strokeWidth="2" />
      <path d="M194 89h30M194 104h30M194 119h18" stroke="currentColor" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
      <circle cx="252" cy="54" r="20" fill="var(--primary)" fillOpacity=".13" />
      <path d="M252 44v20M243 54h18" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
