import Image from "next/image";

export function BrandLogo({
  className,
  priority = false,
}: Readonly<{ className?: string; priority?: boolean }>) {
  return (
    <Image
      className={className}
      src="/Opptium_logo.svg"
      alt="Opptium"
      width={523}
      height={112}
      priority={priority}
    />
  );
}
