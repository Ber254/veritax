use aiken/collection/list
use cardano/address.{Address, Script, VerificationKey}
use cardano/assets
use cardano/transaction.{InlineDatum, Output, OutputReference, Transaction}

pub type State {
  Locked
  Disputed
  Resolved
}

/// Inline datum of every Veritax escrow UTxO. `amount` is in lovelace and
/// `deadline` is a POSIX timestamp in milliseconds.
pub type EscrowDatum {
  party_a: Address,
  party_b: Address,
  arbitrator: Address,
  amount: Int,
  deadline: Int,
  state: State,
}

pub type Action {
  MutualRelease { to_a: Int, to_b: Int }
  ActivateDispute
  ArbitratorRuling { to_a: Int, to_b: Int }
}

validator escrow {
  spend(
    datum: Option<EscrowDatum>,
    redeemer: Action,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(d) = datum
    expect Some(own_input) = transaction.find_input(self.inputs, own_ref)
    let own_output = own_input.output
    expect Script(_) = own_output.address.payment_credential
    // One escrow per transaction, so payouts cannot be shared between escrows.
    expect
      list.count(
        self.inputs,
        fn(i) {
          i.output.address.payment_credential == own_output.address.payment_credential
        },
      ) == 1
    when redeemer is {
      MutualRelease { to_a, to_b } -> and {
          d.state != Resolved,
          signed_by(self, d.party_a),
          signed_by(self, d.party_b),
          pays_split(self, d, to_a, to_b),
        }
      ActivateDispute -> and {
          d.state == Locked,
          signed_by(self, d.party_a) || signed_by(self, d.party_b),
          continues_with(self, own_output, EscrowDatum { ..d, state: Disputed }),
        }
      ArbitratorRuling { to_a, to_b } -> and {
          d.state == Disputed,
          signed_by(self, d.arbitrator),
          pays_split(self, d, to_a, to_b),
        }
    }
  }

  else(_) {
    fail
  }
}

pub fn signed_by(self: Transaction, who: Address) -> Bool {
  when who.payment_credential is {
    VerificationKey(key) -> list.has(self.extra_signatories, key)
    Script(_) -> False
  }
}

pub fn lovelace_paid_to(outputs: List<Output>, who: Address) -> Int {
  list.foldl(
    outputs,
    0,
    fn(o, total) {
      if o.address == who {
        total + assets.lovelace_of(o.value)
      } else {
        total
      }
    },
  )
}

/// `to_a + to_b` is the whole escrowed amount and each party is paid its share.
fn pays_split(self: Transaction, d: EscrowDatum, to_a: Int, to_b: Int) -> Bool {
  and {
    to_a >= 0,
    to_b >= 0,
    to_a + to_b == d.amount,
    if d.party_a == d.party_b {
      lovelace_paid_to(self.outputs, d.party_a) >= d.amount
    } else {
      and {
        lovelace_paid_to(self.outputs, d.party_a) >= to_a,
        lovelace_paid_to(self.outputs, d.party_b) >= to_b,
      }
    },
  }
}

/// Exactly one output goes back to the script with the same value and the
/// expected datum.
fn continues_with(
  self: Transaction,
  own_output: Output,
  expected: EscrowDatum,
) -> Bool {
  expect [out] = list.filter(
    self.outputs,
    fn(o) {
      o.address.payment_credential == own_output.address.payment_credential
    },
  )
  let expected_data: Data = expected
  and {
    out.address == own_output.address,
    out.value == own_output.value,
    out.datum == InlineDatum(expected_data),
  }
}
