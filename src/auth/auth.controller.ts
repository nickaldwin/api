import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { SupabaseAuthUser } from "nestjs-supabase-auth";
import { UserService } from "../user/services/user.service";
import { StripeService } from "../stripe/stripe.service";
import { CustomerService } from "../customer/customer.service";
import { DbUser } from "../user/user.entity";
import { UpdateUserDto } from "../user/dtos/update-user.dto";
import { UpdateUserEmailPreferencesDto } from "../user/dtos/update-user-email-prefs.dto";
import { UpdateUserProfileInterestsDto } from "../user/dtos/update-user-interests.dto";
import { ApplyUserCouponDto } from "../user/dtos/apply-user-coupon.dto";
import { ApplyDeveloperPackDto } from "../user/dtos/apply-developer-pack.dto";
import { CouponService } from "../coupon/coupon.service";
import { SupabaseAuthDto } from "./dtos/supabase-auth-response.dto";
import { User, UserId } from "./supabase.user.decorator";
import { SupabaseGuard } from "./supabase.guard";
import { UserOnboardingDto } from "./dtos/user-onboarding.dto";
import { WaitlistedUsersDto } from "./dtos/waitlisted.dto";

@Controller("auth")
@ApiTags("Authentication service")
export class AuthController {
  constructor(
    private userService: UserService,
    private stripeService: StripeService,
    private customerService: CustomerService,
    private couponService: CouponService
  ) {}

  @Get("/session")
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOperation({
    operationId: "checkAuthSession",
    summary: "Get authenticated session information",
  })
  @ApiOkResponse({ type: SupabaseAuthDto })
  @HttpCode(HttpStatus.OK)
  async getSession(@User() user: SupabaseAuthUser): Promise<SupabaseAuthDto> {
    const {
      role,
      email: session_email,
      confirmed_at,
      last_sign_in_at,
      created_at,
      updated_at,
      user_metadata: { sub: id, user_name },
    } = user;

    let userProfile: Partial<SupabaseAuthDto> = {};

    // check/insert user
    try {
      // get user from public users table
      const {
        is_onboarded,
        is_waitlisted,
        role: insights_role,
        name,
        bio,
        location,
        twitter_username,
        company,
        display_local_time,
        url,
        email,
        github_sponsors_url,
        linkedin_url,
        discord_url,
        notification_count,
        coupon_code,
        insights_count,
        personal_workspace_id,
      } = await this.userService.checkAddUser(user);

      userProfile = {
        is_onboarded,
        insights_role,
        is_waitlisted,
        name,
        location,
        bio,
        twitter_username,
        company,
        display_local_time,
        url,
        email,
        github_sponsors_url,
        linkedin_url,
        discord_url,
        notification_count,
        coupon_code,
        insights_count,
        personal_workspace_id,
      };
    } catch (e) {
      // leave user profile as-is
    }

    return {
      id: `${String(id)}`,
      user_name: `${String(user_name)}`,
      role,
      email: userProfile.email ?? session_email,
      confirmed_at,
      last_sign_in_at,
      created_at,
      updated_at,
      ...userProfile,
    };
  }

  @Post("/onboarding")
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOperation({
    operationId: "postOnboarding",
    summary: "Updates onboarding information for user",
  })
  @ApiOkResponse({ type: SupabaseAuthDto })
  @ApiNotFoundResponse({ description: "Unable to update onboarding information for the user" })
  async postOnboarding(@UserId() userId: number, @Body() body: UserOnboardingDto): Promise<void> {
    const userData = {
      timezone: body.timezone,
      interests: body.interests,
    };

    return this.userService.updateOnboarding(userId, userData);
  }

  @Post("/waitlist")
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOperation({
    operationId: "postWaitlist",
    summary: "Updates waitlist information for user",
  })
  @ApiOkResponse({ type: SupabaseAuthDto })
  @ApiNotFoundResponse({ description: "Unable to update waitlist information for the user" })
  async postWaitlist(@UserId() userId: number): Promise<void> {
    return this.userService.updateWaitlistStatus(userId);
  }

  @Get("/waitlisted")
  @ApiOperation({
    operationId: "getWaitlisted",
    summary: "Gets number of waitlisted users",
  })
  @ApiOkResponse({ type: WaitlistedUsersDto })
  @ApiNotFoundResponse({ description: "Unable to get waitlisted users" })
  async getWaitlisted(): Promise<WaitlistedUsersDto> {
    return this.userService.getNumWaitlisted();
  }

  @Post("/checkout/session")
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOperation({
    operationId: "postCreateCheckoutSession",
    summary: "Creates a new checkout session for the user",
  })
  @ApiOkResponse({ type: SupabaseAuthDto })
  @ApiNotFoundResponse({ description: "Unable to create checkout session" })
  async postCreateCheckoutSession(@User() user: SupabaseAuthUser): Promise<{ sessionId: string }> {
    const customerId = await this.customerService.findByIdOrCreate(user);

    return this.stripeService.createCheckoutSession(customerId);
  }

  @Post("/checkout/workspaces/:id/session")
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOperation({
    operationId: "postCreateCheckoutWorkspacesSession",
    summary: "Creates a new workspaces checkout session for the user",
  })
  @ApiOkResponse({ type: SupabaseAuthDto })
  @ApiNotFoundResponse({ description: "Unable to create workspaces checkout session" })
  @ApiParam({ name: "id", type: "string" })
  async postCreateWorkspacesCheckoutSession(
    @User() user: SupabaseAuthUser,
    @Param("id") workspaceId: string
  ): Promise<{ sessionId: string }> {
    const customerId = await this.customerService.findByIdOrCreate(user);

    return this.stripeService.createWorkspacesCheckoutSession(workspaceId, customerId);
  }

  @Patch("/profile")
  @ApiOperation({
    operationId: "updateProfileForUser",
    summary: "Updates the profile for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbUser })
  @ApiNotFoundResponse({ description: "Unable to update user profile" })
  @ApiBody({ type: UpdateUserDto })
  async updateProfileForUser(@UserId() userId: number, @Body() updateUserDto: UpdateUserDto): Promise<DbUser> {
    return this.userService.updateUser(userId, updateUserDto);
  }

  @Patch("/profile/interests")
  @ApiOperation({
    operationId: "updateInterestsForUserProfile",
    summary: "Updates the interests for the authenticated user profile",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbUser })
  @ApiNotFoundResponse({ description: "Unable to update interests for the user profile" })
  @ApiBody({ type: UpdateUserProfileInterestsDto })
  async updateInterestsForUserProfile(
    @UserId() userId: number,
    @Body() updateUserDto: UpdateUserProfileInterestsDto
  ): Promise<DbUser> {
    await this.userService.updateInterests(userId, updateUserDto);

    return this.userService.findOneById(userId);
  }

  @Patch("/profile/email")
  @ApiOperation({
    operationId: "updateEmailPreferencesForUserProfile",
    summary: "Updates the email preferences for the authenticated user profile",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbUser })
  @ApiNotFoundResponse({ description: "Unable to update email preferences for the user profile" })
  @ApiBody({ type: UpdateUserEmailPreferencesDto })
  async updateEmailPreferencesForUserProfile(
    @UserId() userId: number,
    @Body() updateUserDto: UpdateUserEmailPreferencesDto
  ): Promise<DbUser> {
    await this.userService.updateEmailPreferences(userId, updateUserDto);

    return this.userService.findOneById(userId);
  }

  @Patch("/profile/coupon")
  @ApiOperation({
    operationId: "applyCouponForUser",
    summary: "Applies a coupon for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbUser })
  @ApiNotFoundResponse({ description: "Unable to apply coupon for the user profile" })
  @ApiBody({ type: ApplyUserCouponDto })
  async applyCouponForUser(@UserId() userId: number, @Body() applyUserCouponDto: ApplyUserCouponDto): Promise<DbUser> {
    // check for valid coupon
    await this.couponService.findCoupon(applyUserCouponDto.couponCode);

    await this.userService.applyCoupon(userId, applyUserCouponDto.couponCode);

    return this.userService.findOneById(userId);
  }

  @Patch("/profile/developer-pack")
  @ApiOperation({
    operationId: "addDeveloperPackForUser",
    summary: "Verifies a developer pack for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiBadRequestResponse({ description: "Unable to verify developer pack for the user profile" })
  @ApiBody({ type: ApplyDeveloperPackDto })
  async addDeveloperPackForUser(
    @UserId() userId: number,
    @Body() developerPackUserDto: ApplyDeveloperPackDto
  ): Promise<{ eligible: boolean }> {
    // check for eligibility
    const isVerified = await this.couponService.checkDeveloperPack(developerPackUserDto.token);

    if (isVerified) {
      await this.userService.applyCoupon(userId, "DEVELOPER_PACK");
    }

    return { eligible: isVerified };
  }

  @Delete("/profile")
  @ApiOperation({
    operationId: "deleteUserAccount",
    summary: "Deletes the authenticated user's account",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbUser })
  @ApiNotFoundResponse({ description: "Unable to delete user account" })
  async deleteUserAccount(@UserId() userId: number): Promise<DbUser> {
    return this.userService.deleteUser(userId);
  }

  @Patch("/profile/accept-usage-terms")
  @ApiOperation({
    operationId: "acceptUsageTerms",
    summary: "Accepts the usage terms and conditions for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbUser })
  @ApiNotFoundResponse({ description: "Unable to accept usage terms for the user" })
  async acceptUsageTerms(@UserId() userId: number): Promise<DbUser> {
    await this.userService.acceptTerms(userId);

    return this.userService.findOneById(userId);
  }
}
