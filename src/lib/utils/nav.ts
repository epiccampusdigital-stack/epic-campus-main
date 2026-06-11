export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function navLinkClasses(active: boolean): string {
  const base =
    'flex items-center gap-2 rounded-[9px] px-[10px] py-[8px] text-[12px] font-medium transition-all duration-200 min-h-[44px] sm:min-h-0'
  return active
    ? `${base} border-l-2 border-[#E8A020] bg-[#E8A020]/10 text-[#E8A020] font-semibold`
    : `${base} text-gray-500 dark:text-gray-400 hover:bg-[#0B3D6B]/[0.06] dark:hover:bg-white/5 hover:text-[#0B3D6B] dark:hover:text-white`
}
