import { SearchExperience } from "@/components/search-experience";
import { SearchErrorBoundary } from "@/components/search-error-boundary";

export default function Home() {
  return (
    <SearchErrorBoundary>
      <SearchExperience />
    </SearchErrorBoundary>
  );
}
