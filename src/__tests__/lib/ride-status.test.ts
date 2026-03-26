import { computeRideStatus } from "@/lib/ride-status";

describe("computeRideStatus", () => {
  // Helper to create dates relative to now
  const daysFromNow = (days: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  };

  it("returns 'upcoming' when start date is in the future", () => {
    const start = daysFromNow(5);
    const end = daysFromNow(7);
    expect(computeRideStatus(start, end, "upcoming")).toBe("upcoming");
  });

  it("returns 'ongoing' when current date is between start and end", () => {
    const start = daysFromNow(-2);
    const end = daysFromNow(2);
    expect(computeRideStatus(start, end, "upcoming")).toBe("ongoing");
  });

  it("returns 'ongoing' on the start date itself", () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = daysFromNow(3);
    expect(computeRideStatus(start, end, "upcoming")).toBe("ongoing");
  });

  it("returns 'ongoing' on the end date itself", () => {
    const start = daysFromNow(-3);
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    expect(computeRideStatus(start, end, "upcoming")).toBe("ongoing");
  });

  it("returns 'completed' when end date has passed", () => {
    const start = daysFromNow(-10);
    const end = daysFromNow(-3);
    expect(computeRideStatus(start, end, "upcoming")).toBe("completed");
  });

  it("returns 'cancelled' regardless of dates when DB status is cancelled", () => {
    const start = daysFromNow(5);
    const end = daysFromNow(7);
    expect(computeRideStatus(start, end, "cancelled")).toBe("cancelled");
  });

  it("returns 'cancelled' even if ride dates indicate ongoing", () => {
    const start = daysFromNow(-2);
    const end = daysFromNow(2);
    expect(computeRideStatus(start, end, "cancelled")).toBe("cancelled");
  });

  it("overrides DB status 'upcoming' to 'completed' when dates have passed", () => {
    const start = daysFromNow(-10);
    const end = daysFromNow(-5);
    expect(computeRideStatus(start, end, "upcoming")).toBe("completed");
  });

  it("overrides DB status 'completed' to 'upcoming' when dates are in the future", () => {
    const start = daysFromNow(5);
    const end = daysFromNow(7);
    expect(computeRideStatus(start, end, "completed")).toBe("upcoming");
  });

  it("works with ISO string dates", () => {
    const start = daysFromNow(-2).toISOString();
    const end = daysFromNow(2).toISOString();
    expect(computeRideStatus(start, end, "upcoming")).toBe("ongoing");
  });

  it("handles single-day rides correctly", () => {
    // A single-day ride where start and end are the same day
    const today = new Date();
    const sameDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    expect(computeRideStatus(sameDay, sameDay, "upcoming")).toBe("ongoing");
  });

  it("handles single-day ride that was yesterday", () => {
    const yesterday = daysFromNow(-1);
    expect(computeRideStatus(yesterday, yesterday, "upcoming")).toBe("completed");
  });

  it("handles single-day ride that is tomorrow", () => {
    const tomorrow = daysFromNow(1);
    expect(computeRideStatus(tomorrow, tomorrow, "upcoming")).toBe("upcoming");
  });
});
