import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ForceDark from '@/components/ui/ForceDark'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Always render marketing pages in dark mode */}
      <ForceDark />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}
