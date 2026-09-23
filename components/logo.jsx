export function Logo({ logoUrl, className = 'h-9' }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="LAGARTES ACADEMY" className={`${className} w-auto object-contain`} />
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary font-black text-primary-foreground shadow-[0_0_24px_rgba(159,221,5,0.35)]">
        L
      </div>
      <div className="text-base font-extrabold leading-none tracking-wide text-foreground">
        LAGARTES<span className="text-primary"> ACADEMY</span>
      </div>
    </div>
  )
}
