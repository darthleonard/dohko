import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { KeyManagementService } from '../crypto/key-management.service';
import { VaultSessionService } from './vault-session.service';

@Injectable({
  providedIn: 'root'
})
export class VaultUnlockedGuard implements CanActivate {

  constructor(
    private sessionService: VaultSessionService,
    private keyManagement: KeyManagementService,
    private router: Router
  ) {}

  public async canActivate(): Promise<boolean | UrlTree> {
    const hasVault = await this.keyManagement.hasVault();
    if (!hasVault) {
      return this.router.parseUrl('/onboarding');
    }

    if (!this.sessionService.isUnlocked()) {
      return this.router.parseUrl('/unlock');
    }

    return true;
  }
}

@Injectable({
  providedIn: 'root'
})
export class VaultLockedGuard implements CanActivate {

  constructor(
    private sessionService: VaultSessionService,
    private keyManagement: KeyManagementService,
    private router: Router
  ) {}

  public async canActivate(): Promise<boolean | UrlTree> {
    const hasVault = await this.keyManagement.hasVault();
    if (!hasVault) {
      return this.router.parseUrl('/onboarding');
    }

    if (this.sessionService.isUnlocked()) {
      return this.router.parseUrl('/credentials');
    }

    return true;
  }
}

@Injectable({
  providedIn: 'root'
})
export class OnboardingGuard implements CanActivate {

  constructor(
    private keyManagement: KeyManagementService,
    private sessionService: VaultSessionService,
    private router: Router
  ) {}

  public async canActivate(): Promise<boolean | UrlTree> {
    const hasVault = await this.keyManagement.hasVault();
    if (hasVault) {
      if (this.sessionService.isUnlocked()) {
        return this.router.parseUrl('/credentials');
      }
      return this.router.parseUrl('/unlock');
    }

    return true;
  }
}
