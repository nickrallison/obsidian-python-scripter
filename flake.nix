{
  description = "A flake for Rust development";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";

  outputs = { self, nixpkgs }: {

    devShell.x86_64-linux = with nixpkgs.legacyPackages.x86_64-linux; mkShellNoCC {
      packages = with pkgs; [
        yarn
      ];

      shellHook = ''
      '';
    };

    devShell.aarch64-darwin = with nixpkgs.legacyPackages.aarch64-darwin; mkShellNoCC {
      packages = with pkgs; [
        yarn
      ];
    };

    shellHook = ''
    '';

  };
}

