import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AddressService } from './address.service';

@Controller('address')
export class AddressController {
    constructor(private readonly addressService: AddressService) {}

    @Get('nearby/:userId')
    findNearbyFriends(@Param('userId') userId: string, @Query('radius') radius: string): Promise<any[]> {
        const radiusKm = parseFloat(radius);
        if (isNaN(radiusKm) || radiusKm <= 0) {
            throw new BadRequestException('radius query parameter must be a positive number (in km)');
        }
        return this.addressService.findNearbyFriends(userId, radiusKm);
    }

    @Post(':userId')
    createAddress(
        @Param('userId') userId: string,
        @Body()
        body: { street: string; zip: string; city: string; country: string; latitude: number; longitude: number },
    ): Promise<any> {
        return this.addressService.createAddress(userId, body);
    }

    @Get(':userId')
    getAddress(@Param('userId') userId: string): Promise<any> {
        return this.addressService.getAddress(userId);
    }

    @Patch(':userId')
    updateAddress(
        @Param('userId') userId: string,
        @Body()
        body: { street?: string; zip?: string; city?: string; country?: string; latitude?: number; longitude?: number },
    ): Promise<any> {
        return this.addressService.updateAddress(userId, body);
    }

    @Delete(':userId')
    deleteAddress(@Param('userId') userId: string) {
        return this.addressService.deleteAddress(userId);
    }
}
