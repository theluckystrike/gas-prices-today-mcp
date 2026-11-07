# Data sources

All sources below were fetched on 2026-11-07 while building version 1.0.0.

| Data | URL | Notes |
|---|---|---|
| Weekly retail regular gasoline by area | https://www.eia.gov/dnav/pet/pet_pri_gnd_a_epmr_pte_dpgal_w.htm | Release 11/3/2026, latest week 11/02/26: U.S. 4.153, California 5.748, Texas 3.578, Chicago 4.706, Houston 3.625, West Coast (PADD 5) 5.296. Read at call time, cached 15 minutes. Keyless, public domain. Next release 11/10/2026. |
| Weekly retail midgrade, premium, all grades | https://www.eia.gov/dnav/pet/pet_pri_gnd_a_epmm_pte_dpgal_w.htm (epmp, epm0) | Same layout. All grades U.S. 4.290. |
| Weekly retail on-highway diesel by area | https://www.eia.gov/dnav/pet/pet_pri_gnd_a_epd2d_pte_dpgal_w.htm | U.S. 6.292, California 8.076, Gulf Coast (PADD 3) 5.912. Eleven areas (U.S., regions, California). |
| Weekly history per series | https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_NUS_DPG&f=W | Series ID taken from each table row's History link. U.S. regular 3.019 on 11/03/2025. |
| U.S. summary page (cross-check) | https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_nus_w.htm | U.S. regular 4.153, all grades 4.290, diesel 6.292, week of 11/02/26. |
| PADD definitions | https://www.eia.gov/dnav/pet/TblDefs/pet_pri_gnd_tbldef2.asp | 1A CT ME MA NH RI VT; 1B DE DC MD NJ NY PA; 1C FL GA NC SC VA WV; 2 IL IN IA KS KY MI MN MO NE ND OH OK SD TN WI; 3 AL AR LA MS NM TX; 4 CO ID MT UT WY; 5 AK AZ CA HI NV OR WA. |

The test fixtures in `test/fixtures/` are the EIA pages downloaded on 2026-11-07.
