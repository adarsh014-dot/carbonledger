const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const BYTES32_ZERO = ethers.ZeroHash;
const hash = (text) => ethers.keccak256(ethers.toUtf8Bytes(text));

async function deployFixture() {
  const [admin, verifier, developer, buyer, outsider, treasury] = await ethers.getSigners();

  const Registry = await ethers.getContractFactory("ProjectRegistry");
  const registry = await Registry.deploy(admin.address);

  const Certificate = await ethers.getContractFactory("RetirementCertificate");
  const certificate = await Certificate.deploy(admin.address);

  const Token = await ethers.getContractFactory("CarbonCreditToken");
  const token = await Token.deploy(admin.address, await registry.getAddress());

  const Marketplace = await ethers.getContractFactory("CarbonMarketplace");
  const marketplace = await Marketplace.deploy(
    admin.address,
    await token.getAddress(),
    treasury.address
  );

  await registry.grantRole(await registry.CREDIT_TOKEN_ROLE(), await token.getAddress());
  await registry.grantRole(await registry.VERIFIER_ROLE(), verifier.address);
  await certificate.grantRole(await certificate.MINTER_ROLE(), await token.getAddress());
  await token.setCertificateContract(await certificate.getAddress());

  return {
    admin,
    verifier,
    developer,
    buyer,
    outsider,
    treasury,
    registry,
    token,
    certificate,
    marketplace,
  };
}

async function withProjectFixture() {
  const base = await deployFixture();
  const { registry, developer, verifier } = base;

  const tx = await registry
    .connect(developer)
    .registerProject(
      "Western Ghats Reforestation",
      "Karnataka, India",
      "Verra VM0047 v1.0",
      hash("methodology-document-v1"),
      5000
    );
  await tx.wait();

  await registry.connect(verifier).verifyProject(1);

  return base;
}

async function withBatchFixture() {
  const base = await withProjectFixture();
  const { token, admin } = base;

  await token.connect(admin).issueBatch(1, 2025, 1000, hash("batch-serial-001"));

  return base;
}

describe("CarbonLedger", function () {
  describe("ProjectRegistry", function () {
    it("grants admin, verifier and pauser roles to the deployer", async function () {
      const { registry, admin } = await loadFixture(deployFixture);
      expect(await registry.hasRole(await registry.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
      expect(await registry.hasRole(await registry.VERIFIER_ROLE(), admin.address)).to.equal(true);
      expect(await registry.hasRole(await registry.PAUSER_ROLE(), admin.address)).to.equal(true);
    });

    it("registers a project and emits an event", async function () {
      const { registry, developer } = await loadFixture(deployFixture);
      const docHash = hash("methodology-document");

      await expect(
        registry
          .connect(developer)
          .registerProject("Sundarbans Mangrove", "West Bengal", "Gold Standard GS4.1", docHash, 2000)
      )
        .to.emit(registry, "ProjectRegistered")
        .withArgs(1, developer.address, "Sundarbans Mangrove", docHash);

      const project = await registry.getProject(1);
      expect(project.developer).to.equal(developer.address);
      expect(project.name).to.equal("Sundarbans Mangrove");
      expect(project.annualCapacityTonnes).to.equal(2000n);
      expect(project.verified).to.equal(false);
      expect(await registry.projectCount()).to.equal(1n);
    });

    it("keeps the verified project count correct across verify, revoke and re-verify", async function () {
      const { registry, developer, verifier } = await loadFixture(deployFixture);
      await registry.connect(developer).registerProject("Project A", "Goa", "Method A", hash("a"), 100);
      await registry.connect(developer).registerProject("Project B", "Goa", "Method B", hash("b"), 100);
      expect(await registry.getVerifiedProjectCount()).to.equal(0n);

      await registry.connect(verifier).verifyProject(1);
      await registry.connect(verifier).verifyProject(2);
      expect(await registry.getVerifiedProjectCount()).to.equal(2n);

      await registry.connect(verifier).revokeVerification(2);
      expect(await registry.getVerifiedProjectCount()).to.equal(1n);
    });

    it("rejects duplicate methodology documents", async function () {
      const { registry, developer, outsider, admin } = await loadFixture(deployFixture);
      const docHash = hash("same-document");
      await registry.connect(developer).registerProject("Project A", "Goa", "Method A", docHash, 100);

      await expect(
        registry.connect(outsider).registerProject("Project B", "Goa", "Method B", docHash, 100)
      ).to.be.revertedWith("REG: document already registered");
    });

    it("validates project input", async function () {
      const { registry, developer } = await loadFixture(deployFixture);
      await expect(
        registry.connect(developer).registerProject("A", "Goa", "Method", hash("x"), 100)
      ).to.be.revertedWith("REG: invalid name");
      await expect(
        registry.connect(developer).registerProject("Valid", "Goa", "Method", BYTES32_ZERO, 100)
      ).to.be.revertedWith("REG: empty document hash");
      await expect(
        registry.connect(developer).registerProject("Valid", "Goa", "Method", hash("y"), 0)
      ).to.be.revertedWith("REG: capacity is zero");
    });

    it("only lets a verifier verify a project", async function () {
      const { registry, developer, outsider, admin } = await loadFixture(deployFixture);
      await registry.connect(developer).registerProject("Project", "Goa", "Method", hash("doc"), 100);

      await expect(registry.connect(outsider).verifyProject(1)).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount"
      );

      await registry.connect(admin).grantRole(await registry.VERIFIER_ROLE(), outsider.address);
      await expect(registry.connect(outsider).verifyProject(1)).to.emit(registry, "ProjectVerified");
      expect(await registry.isVerified(1)).to.equal(true);
    });

    it("prevents double verification and requires verification to revoke", async function () {
      const { registry } = await loadFixture(withProjectFixture);
      await expect(registry.verifyProject(1)).to.be.revertedWith("REG: already verified");
      await expect(registry.revokeVerification(2)).to.be.revertedWith("REG: project does not exist");
    });

    it("revocation disables issuance eligibility", async function () {
      const { registry, token, admin } = await loadFixture(withBatchFixture);
      await registry.revokeVerification(1);
      expect(await registry.isVerified(1)).to.equal(false);

      await expect(
        token.connect(admin).issueBatch(1, 2025, 10, hash("after-revoke"))
      ).to.be.revertedWith("TOKEN: project not verified");
    });

    it("paginates projects", async function () {
      const { registry, developer } = await loadFixture(deployFixture);
      for (let i = 0; i < 5; i++) {
        await registry
          .connect(developer)
          .registerProject(`Project ${i}`, "India", "Method", hash(`doc-${i}`), 100);
      }

      const [page, total] = await registry.getProjects(1, 3);
      expect(total).to.equal(5n);
      expect(page.length).to.equal(3);
      expect(page[0].id).to.equal(2n);
      expect(page[2].id).to.equal(4n);
    });

    it("counts verified projects", async function () {
      const { registry, developer } = await loadFixture(withProjectFixture);
      await registry.connect(developer).registerProject("Pending", "Goa", "Method", hash("p"), 10);
      expect(await registry.getVerifiedProjectCount()).to.equal(1n);
    });

    it("can be paused by an authorised account", async function () {
      const { registry, developer } = await loadFixture(deployFixture);
      await registry.pause();
      await expect(
        registry.connect(developer).registerProject("Project", "Goa", "Method", hash("doc"), 100)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");

      await registry.unpause();
      await expect(
        registry.connect(developer).registerProject("Project", "Goa", "Method", hash("doc"), 100)
      ).to.emit(registry, "ProjectRegistered");
    });
  });

  describe("CarbonCreditToken", function () {
    it("issues a batch to the minter and records tonnage", async function () {
      const { token, admin } = await loadFixture(withProjectFixture);
      const serial = hash("batch-serial-001");

      await expect(token.connect(admin).issueBatch(1, 2025, 1000, serial))
        .to.emit(token, "BatchIssued")
        .withArgs(1, 1, admin.address, 2025, 1000, serial);

      expect(await token.balanceOf(admin.address, 1)).to.equal(1000n);
      expect(await token.totalIssuedTonnes()).to.equal(1000n);
      expect(await token.batchCount()).to.equal(1n);

      const batch = await token.getBatch(1);
      expect(batch.projectId).to.equal(1n);
      expect(batch.vintage).to.equal(2025n);
      expect(batch.tonnes).to.equal(1000n);
    });

    it("only allows MINTER_ROLE to issue", async function () {
      const { token, outsider } = await loadFixture(withProjectFixture);
      await expect(
        token.connect(outsider).issueBatch(1, 2025, 10, hash("serial"))
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("refuses to issue for an unverified project", async function () {
      const { token, developer, admin } = await loadFixture(deployFixture);
      await token.connect(admin).grantRole(await token.MINTER_ROLE(), developer.address);

      await expect(
        token.connect(developer).issueBatch(1, 2025, 10, hash("serial"))
      ).to.be.revertedWith("TOKEN: project not verified");
    });

    it("rejects duplicate serials and invalid vintages", async function () {
      const { token, admin } = await loadFixture(withBatchFixture);
      const serial = hash("batch-serial-001");

      await expect(token.connect(admin).issueBatch(1, 2025, 10, serial)).to.be.revertedWith(
        "TOKEN: serial already issued"
      );
      await expect(token.connect(admin).issueBatch(1, 1800, 10, hash("new"))).to.be.revertedWith(
        "TOKEN: invalid vintage"
      );
    });

    it("enforces the project annual capacity", async function () {
      const { token, admin } = await loadFixture(withBatchFixture); // 1000 / 5000 used
      await expect(
        token.connect(admin).issueBatch(1, 2025, 5000, hash("too-much"))
      ).to.be.revertedWith("REG: annual capacity exceeded");
    });

    it("retires credits, burns them and mints a soulbound certificate", async function () {
      const { token, certificate, admin, buyer } = await loadFixture(withBatchFixture);

      await expect(token.connect(admin).retireCredits(1, 250, buyer.address, "Offsetting 2025 flights"))
        .to.emit(token, "CreditsRetired")
        .withArgs(1, admin.address, buyer.address, 250, 1, "Offsetting 2025 flights")
        .and.to.emit(certificate, "CertificateMinted");

      expect(await token.balanceOf(admin.address, 1)).to.equal(750n);
      expect(await token.totalRetiredTonnes()).to.equal(250n);
      expect(await certificate.ownerOf(1)).to.equal(buyer.address);
      expect(await certificate.certificateCount()).to.equal(1n);

      const cert = await certificate.getCertificate(1);
      expect(cert.tonnes).to.equal(250n);
      expect(cert.beneficiary).to.equal(buyer.address);
      expect(cert.purpose).to.equal("Offsetting 2025 flights");
    });

    it("supports partial retirement", async function () {
      const { token, admin, buyer } = await loadFixture(withBatchFixture);
      await token.connect(admin).retireCredits(1, 100, buyer.address, "Scope 1");
      await token.connect(admin).retireCredits(1, 150, buyer.address, "Scope 2");

      const batch = await token.getBatch(1);
      expect(batch.retiredTonnes).to.equal(250n);
      expect(await token.balanceOf(admin.address, 1)).to.equal(750n);
      expect(await token.totalRetiredTonnes()).to.equal(250n);
    });

    it("rejects invalid retirements", async function () {
      const { token, admin, buyer } = await loadFixture(withBatchFixture);
      await expect(
        token.connect(admin).retireCredits(1, 1001, buyer.address, "Too many")
      ).to.be.revertedWith("TOKEN: insufficient credits");
      await expect(
        token.connect(admin).retireCredits(1, 0, buyer.address, "Zero")
      ).to.be.revertedWith("TOKEN: zero tonnage");
      await expect(
        token.connect(admin).retireCredits(1, 10, ethers.ZeroAddress, "Zero address")
      ).to.be.revertedWith("TOKEN: beneficiary is zero");
    });

    it("makes retirement certificates non-transferable", async function () {
      const { token, certificate, admin, buyer, outsider } = await loadFixture(withBatchFixture);
      await token.connect(admin).retireCredits(1, 50, buyer.address, "Offset");

      await expect(
        certificate.connect(buyer).transferFrom(buyer.address, outsider.address, 1)
      ).to.be.revertedWith("CERT: non-transferable");
    });

    it("returns fully on-chain metadata for a certificate", async function () {
      const { token, certificate, admin, buyer } = await loadFixture(withBatchFixture);
      await token.connect(admin).retireCredits(1, 42, buyer.address, "Conference travel");

      const uri = await certificate.tokenURI(1);
      expect(uri.startsWith("data:application/json;base64,")).to.equal(true);

      const json = JSON.parse(
        Buffer.from(uri.split(",")[1], "base64").toString("utf8")
      );
      expect(json.name).to.equal("Carbon Retirement Certificate #1");
      expect(json.attributes[0].value).to.equal(42);
      expect(json.image.startsWith("data:image/svg+xml;base64,")).to.equal(true);
    });

    it("keeps metadata valid JSON when the purpose contains control characters", async function () {
      const { token, certificate, admin, buyer } = await loadFixture(withBatchFixture);
      await token
        .connect(admin)
        .retireCredits(1, 5, buyer.address, "Line one\nline two\ttabbed\"quoted\"");

      const uri = await certificate.tokenURI(1);
      const json = JSON.parse(
        Buffer.from(uri.split(",")[1], "base64").toString("utf8")
      );
      const purpose = json.attributes.find((a) => a.trait_type === "Purpose").value;
      expect(purpose).to.include("line two");
      expect(purpose).to.include("quoted");
    });

    it("transfers credits between accounts", async function () {
      const { token, admin, buyer } = await loadFixture(withBatchFixture);
      await token
        .connect(admin)
        .safeTransferFrom(admin.address, buyer.address, 1, 400, "0x");

      expect(await token.balanceOf(buyer.address, 1)).to.equal(400n);
      expect(await token.balanceOf(admin.address, 1)).to.equal(600n);
    });

    it("blocks transfers when paused", async function () {
      const { token, admin, buyer } = await loadFixture(withBatchFixture);
      await token.pause();
      await expect(
        token.connect(admin).safeTransferFrom(admin.address, buyer.address, 1, 10, "0x")
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });
  });

  describe("CarbonMarketplace", function () {
    async function withListingFixture() {
      const base = await withBatchFixture();
      const { token, marketplace, admin } = base;
      await token.connect(admin).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(admin).listCredits(1, 500, ethers.parseEther("0.001"));
      return base;
    }

    it("escrows credits when listing", async function () {
      const { marketplace, token, admin } = await loadFixture(withListingFixture);
      expect(await token.balanceOf(await marketplace.getAddress(), 1)).to.equal(500n);
      expect(await token.balanceOf(admin.address, 1)).to.equal(500n);

      const listing = await marketplace.getListing(1);
      expect(listing.seller).to.equal(admin.address);
      expect(listing.remaining).to.equal(500n);
      expect(listing.active).to.equal(true);
    });

    it("requires token approval before listing", async function () {
      const { token, marketplace, admin } = await loadFixture(withBatchFixture);
      await expect(
        marketplace.connect(admin).listCredits(1, 10, ethers.parseEther("0.001"))
      ).to.be.revertedWithCustomError(token, "ERC1155MissingApprovalForAll");
    });

    it("sells credits, credits seller proceeds and accrues fees", async function () {
      const { marketplace, token, admin, buyer } = await loadFixture(withListingFixture);
      const price = ethers.parseEther("0.001");
      const amount = 200n;
      const cost = price * amount;
      const fee = (cost * 250n) / 10000n;

      await expect(marketplace.connect(buyer).buyCredits(1, amount, { value: cost }))
        .to.emit(marketplace, "Purchased")
        .withArgs(1, buyer.address, admin.address, amount, cost, fee);

      expect(await token.balanceOf(buyer.address, 1)).to.equal(amount);
      expect(await marketplace.proceeds(admin.address)).to.equal(cost - fee);
      expect(await marketplace.accruedFees()).to.equal(fee);

      const listing = await marketplace.getListing(1);
      expect(listing.remaining).to.equal(300n);
      expect(listing.active).to.equal(true);
    });

    it("closes the listing when fully sold", async function () {
      const { marketplace, admin, buyer } = await loadFixture(withListingFixture);
      const price = ethers.parseEther("0.001");
      await marketplace.connect(buyer).buyCredits(1, 500, { value: price * 500n });
      const listing = await marketplace.getListing(1);
      expect(listing.remaining).to.equal(0n);
      expect(listing.active).to.equal(false);
    });

    it("rejects incorrect payments and over-buying", async function () {
      const { marketplace, buyer } = await loadFixture(withListingFixture);
      const price = ethers.parseEther("0.001");

      await expect(
        marketplace.connect(buyer).buyCredits(1, 10, { value: price })
      ).to.be.revertedWith("MKT: incorrect payment");

      await expect(
        marketplace.connect(buyer).buyCredits(1, 501, { value: price * 501n })
      ).to.be.revertedWith("MKT: amount exceeds listing");
    });

    it("returns unsold credits on cancel and blocks non-sellers", async function () {
      const { marketplace, token, admin, buyer } = await loadFixture(withListingFixture);

      await expect(marketplace.connect(buyer).cancelListing(1)).to.be.revertedWith(
        "MKT: not seller"
      );

      await expect(marketplace.connect(admin).cancelListing(1))
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(1, admin.address, 500);

      expect(await token.balanceOf(admin.address, 1)).to.equal(1000n);
      expect((await marketplace.getListing(1)).active).to.equal(false);
    });

    it("lets sellers withdraw proceeds and the admin withdraw fees", async function () {
      const { marketplace, admin, buyer, treasury } = await loadFixture(withListingFixture);
      const price = ethers.parseEther("0.001");
      await marketplace.connect(buyer).buyCredits(1, 100, { value: price * 100n });

      const proceedsBefore = await marketplace.proceeds(admin.address);
      await expect(marketplace.connect(admin).withdrawProceeds())
        .to.emit(marketplace, "ProceedsWithdrawn")
        .withArgs(admin.address, proceedsBefore);
      expect(await marketplace.proceeds(admin.address)).to.equal(0n);

      const fees = await marketplace.accruedFees();
      await expect(marketplace.withdrawFees())
        .to.emit(marketplace, "FeesWithdrawn")
        .withArgs(treasury.address, fees);
      expect(await marketplace.accruedFees()).to.equal(0n);
    });

    it("caps the platform fee and restricts fee changes to admin", async function () {
      const { marketplace, outsider } = await loadFixture(withListingFixture);
      await expect(marketplace.connect(outsider).setFeeBps(100)).to.be.revertedWithCustomError(
        marketplace,
        "AccessControlUnauthorizedAccount"
      );
      await expect(marketplace.setFeeBps(1001)).to.be.revertedWith("MKT: fee above cap");
      await expect(marketplace.setFeeBps(500)).to.emit(marketplace, "FeeUpdated");
      expect(await marketplace.feeBps()).to.equal(500n);
    });

    it("keeps the active listing count correct across list, partial sale and cancel", async function () {
      const { marketplace, admin, buyer } = await loadFixture(withListingFixture);
      expect(await marketplace.activeListingCount()).to.equal(1n);

      // a second listing from the remaining credits
      await marketplace.connect(admin).listCredits(1, 400, ethers.parseEther("0.002"));
      expect(await marketplace.activeListingCount()).to.equal(2n);

      // partial fill: listing 1 stays active
      await marketplace
        .connect(buyer)
        .buyCredits(1, 100, { value: ethers.parseEther("0.1") });
      expect(await marketplace.activeListingCount()).to.equal(2n);

      // cancel listing 2; listing 1 still active
      await marketplace.connect(admin).cancelListing(2);
      expect(await marketplace.activeListingCount()).to.equal(1n);
    });

    it("cannot list zero amounts or below balance", async function () {
      const { marketplace } = await loadFixture(withListingFixture);
      await expect(
        marketplace.listCredits(1, 0, ethers.parseEther("0.001"))
      ).to.be.revertedWith("MKT: zero amount");
      await expect(
        marketplace.listCredits(1, 10_000, ethers.parseEther("0.001"))
      ).to.be.revertedWith("MKT: insufficient credits");
    });
  });
});
