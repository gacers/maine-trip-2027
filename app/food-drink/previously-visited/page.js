import CollectionPage from "@/components/CollectionPage";
import { COLLECTIONS } from "@/lib/collections";

export default function PreviouslyVisitedPage() {
  return <CollectionPage collection={COLLECTIONS.visitedFoodDrink} />;
}
