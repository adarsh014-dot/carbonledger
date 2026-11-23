import { Contract } from "ethers";
import addresses from "../contracts/addresses.json";
import ProjectRegistryAbi from "../contracts/abis/ProjectRegistry.json";
import CarbonCreditTokenAbi from "../contracts/abis/CarbonCreditToken.json";
import RetirementCertificateAbi from "../contracts/abis/RetirementCertificate.json";
import CarbonMarketplaceAbi from "../contracts/abis/CarbonMarketplace.json";

export { addresses };

export const ABIS = {
  ProjectRegistry: ProjectRegistryAbi,
  CarbonCreditToken: CarbonCreditTokenAbi,
  RetirementCertificate: RetirementCertificateAbi,
  CarbonMarketplace: CarbonMarketplaceAbi,
};

export function buildContracts(runner) {
  if (!runner) return null;
  return {
    registry: new Contract(addresses.ProjectRegistry, ABIS.ProjectRegistry, runner),
    token: new Contract(addresses.CarbonCreditToken, ABIS.CarbonCreditToken, runner),
    certificate: new Contract(
      addresses.RetirementCertificate,
      ABIS.RetirementCertificate,
      runner
    ),
    marketplace: new Contract(addresses.CarbonMarketplace, ABIS.CarbonMarketplace, runner),
  };
}
