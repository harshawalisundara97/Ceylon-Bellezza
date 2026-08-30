import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SearchResults from "@/components/SearchResults";

export default function SearchPage() {
  return (
    <main>
      <Header />
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
      <Footer />
    </main>
  );
}
