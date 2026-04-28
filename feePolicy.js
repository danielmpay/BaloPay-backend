/////////////////////////////////////
// FEE POLICY
/////////////////////////////////////
class FeePolicy {
  constructor(fee, min, max) {
    if (typeof fee !== "number" || isNaN(fee) || !isFinite(fee)) {
      throw new Error("Invalid fee");
    }
    if (typeof min !== "number" || isNaN(min) || !isFinite(min)) {
      throw new Error("Invalid minimum");
    }
    if (typeof max !== "number" || isNaN(max) || !isFinite(max)) {
      throw new Error("Invalid maximum");
    }

    this.fee = fee;
    this.min = min;
    this.max = max;
  }

  calculate(amount) {
    let fee = amount * this.fee;
    if (fee < this.min) {
      fee = this.min;
    }
    if (fee > this.max) {
      fee = this.max;
    }
    return fee;
  }
}

module.exports = FeePolicy;
