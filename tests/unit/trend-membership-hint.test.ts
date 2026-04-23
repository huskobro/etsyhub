import { describe, expect, it } from "vitest";
import { pickTopMembership } from "@/features/trend-stories/services/feed-service";

type Cluster = {
  id: string;
  label: string;
  seasonalTag: string | null;
  clusterScore: number;
  storeCount: number;
  memberCount: number;
};

type MkInput = Partial<Cluster> & { id: string; label: string; seasonalTag?: string | null };

function mk(overrides: MkInput): { cluster: Cluster } {
  return {
    cluster: {
      id: overrides.id,
      label: overrides.label,
      seasonalTag: overrides.seasonalTag ?? null,
      clusterScore: overrides.clusterScore ?? 10,
      storeCount: overrides.storeCount ?? 2,
      memberCount: overrides.memberCount ?? 3,
    },
  };
}

describe("pickTopMembership", () => {
  it("boş dizi → null", () => {
    expect(pickTopMembership([])).toBeNull();
  });

  it("tek üye → doğrudan o döner", () => {
    const m = mk({ id: "c1", label: "boho wall art", clusterScore: 20, storeCount: 3, memberCount: 5 });
    const result = pickTopMembership([m]);
    expect(result).toEqual({ clusterId: "c1", label: "boho wall art", seasonalTag: null });
  });

  it("clusterScore farklı → en yüksek score seçilir", () => {
    const memberships = [
      mk({ id: "c10", label: "cluster 10", clusterScore: 10 }),
      mk({ id: "c50", label: "cluster 50", clusterScore: 50 }),
      mk({ id: "c30", label: "cluster 30", clusterScore: 30 }),
    ];
    const result = pickTopMembership(memberships);
    expect(result?.clusterId).toBe("c50");
  });

  it("clusterScore eşit, storeCount farklı → büyük storeCount seçilir", () => {
    const memberships = [
      mk({ id: "c1", label: "cluster a", clusterScore: 20, storeCount: 3 }),
      mk({ id: "c2", label: "cluster b", clusterScore: 20, storeCount: 5 }),
      mk({ id: "c3", label: "cluster c", clusterScore: 20, storeCount: 4 }),
    ];
    const result = pickTopMembership(memberships);
    expect(result?.clusterId).toBe("c2");
  });

  it("clusterScore + storeCount eşit, memberCount farklı → büyük memberCount seçilir", () => {
    const memberships = [
      mk({ id: "c1", label: "cluster a", clusterScore: 20, storeCount: 3, memberCount: 10 }),
      mk({ id: "c2", label: "cluster b", clusterScore: 20, storeCount: 3, memberCount: 20 }),
      mk({ id: "c3", label: "cluster c", clusterScore: 20, storeCount: 3, memberCount: 15 }),
    ];
    const result = pickTopMembership(memberships);
    expect(result?.clusterId).toBe("c2");
  });

  it("hepsi eşit, label farklı → alfabetik en küçük label seçilir", () => {
    const memberships = [
      mk({ id: "cz", label: "zebra", clusterScore: 20, storeCount: 3, memberCount: 10 }),
      mk({ id: "ca", label: "apple", clusterScore: 20, storeCount: 3, memberCount: 10 }),
      mk({ id: "cm", label: "mango", clusterScore: 20, storeCount: 3, memberCount: 10 }),
    ];
    const result = pickTopMembership(memberships);
    expect(result?.clusterId).toBe("ca");
    expect(result?.label).toBe("apple");
  });

  it("seçilen cluster'ın seasonalTag'i doğru taşınır — string değer", () => {
    const memberships = [
      mk({ id: "c1", label: "cluster a", clusterScore: 10, seasonalTag: null }),
      mk({ id: "c2", label: "cluster b", clusterScore: 50, seasonalTag: "christmas" }),
    ];
    const result = pickTopMembership(memberships);
    expect(result?.clusterId).toBe("c2");
    expect(result?.seasonalTag).toBe("christmas");
  });

  it("seçilen cluster'ın seasonalTag'i doğru taşınır — null değer", () => {
    const memberships = [
      mk({ id: "c1", label: "cluster a", clusterScore: 50, seasonalTag: null }),
      mk({ id: "c2", label: "cluster b", clusterScore: 10, seasonalTag: "halloween" }),
    ];
    const result = pickTopMembership(memberships);
    expect(result?.clusterId).toBe("c1");
    expect(result?.seasonalTag).toBeNull();
  });
});
